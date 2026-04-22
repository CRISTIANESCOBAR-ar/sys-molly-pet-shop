import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, updateDoc, doc, serverTimestamp,
  query, orderBy, where, Timestamp, runTransaction, limit, getDocs, startAfter,
} from 'firebase/firestore'
import { db } from '@/firebase/firebaseConfig'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUsageMetricsStore } from '@/stores/useUsageMetricsStore'

export const useComprasStore = defineStore('compras', () => {
  const compras = ref([])
  const pageSize = 30
  const periodoActualKey = ref('')
  const periodoInicio = ref(null)
  const periodoFin = ref(null)
  const ultimoDocPeriodo = ref(null)
  const hasMorePeriodo = ref(false)
  const loadingPeriodo = ref(false)
  const loadingMorePeriodo = ref(false)

  // ─── Computed ──────────────────────────────────────────────────────────────
  const comprasActivas = computed(() =>
    compras.value.filter(c => (c.estado || 'activa') !== 'anulada'),
  )

  const totalPeriodo = computed(() =>
    comprasActivas.value.reduce((s, c) => s + (c.total ?? 0), 0),
  )

  const porProveedor = computed(() => {
    const map = {}
    for (const c of comprasActivas.value) {
      const p = c.proveedor || 'Sin proveedor'
      map[p] = (map[p] || 0) + (c.total ?? 0)
    }
    return map
  })

  // ─── Paginación por período (evita traer el mes completo) ────────────────
  async function initPeriodo(inicio, fin, options = {}) {
    const force = Boolean(options.force)
    const key = `${inicio.getTime()}-${fin.getTime()}`
    if (!force && periodoActualKey.value === key && compras.value.length > 0) return

    periodoActualKey.value = key
    periodoInicio.value = inicio
    periodoFin.value = fin
    ultimoDocPeriodo.value = null
    hasMorePeriodo.value = true
    compras.value = []

    loadingPeriodo.value = true
    try {
      await loadMorePeriodo()
    } finally {
      loadingPeriodo.value = false
    }
  }

  async function loadMorePeriodo() {
    if (loadingMorePeriodo.value || !hasMorePeriodo.value || !periodoInicio.value || !periodoFin.value) return

    loadingMorePeriodo.value = true
    try {
      const metrics = useUsageMetricsStore()
      const base = [
        collection(db, 'compras'),
        where('fecha', '>=', Timestamp.fromDate(periodoInicio.value)),
        where('fecha', '<=', Timestamp.fromDate(periodoFin.value)),
        orderBy('fecha', 'desc'),
      ]

      const q = ultimoDocPeriodo.value
        ? query(...base, startAfter(ultimoDocPeriodo.value), limit(pageSize))
        : query(...base, limit(pageSize))

      const snap = await getDocs(q)
      const batch = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      compras.value = [...compras.value, ...batch]
      ultimoDocPeriodo.value = snap.docs[snap.docs.length - 1] || null
      hasMorePeriodo.value = snap.docs.length === pageSize

      metrics.trackReadEstimate('compras.periodo.page', snap.docs.length)
    } finally {
      loadingMorePeriodo.value = false
    }
  }

  // Compatibilidad: mantiene API anterior sin listener realtime.
  function subscribeByPeriodo(inicio, fin, onReady) {
    let activo = true
    initPeriodo(inicio, fin, { force: true })
      .finally(() => {
        if (activo) onReady?.()
      })
    return () => {
      activo = false
    }
  }

  // ─── Registrar nueva compra ───────────────────────────────────────────────
  async function registrarCompra(data) {
    const authStore = useAuthStore()
    const metrics = useUsageMetricsStore()

    const nombreNormalizado = data.nombre.trim().toUpperCase()
    const cantidad = Number(data.cantidad)
    if (!nombreNormalizado || cantidad <= 0) throw new Error('Compra inválida')

    await runTransaction(db, async (tx) => {
      let productoRef = null
      if (data.producto_id) {
        productoRef = doc(db, 'productos', data.producto_id)
        const productoSnap = await tx.get(productoRef)
        if (!productoSnap.exists()) productoRef = null
      }

      if (!productoRef) {
        const qProd = query(
          collection(db, 'productos'),
          where('nombre', '==', nombreNormalizado),
          limit(1),
        )
        const prodSnap = await tx.get(qProd)
        if (!prodSnap.empty) productoRef = prodSnap.docs[0].ref
      }

      if (!productoRef) {
        throw new Error('No se encontró el producto para actualizar stock')
      }

      const productoSnap = await tx.get(productoRef)
      const stockActual = Number(productoSnap.data()?.stock ?? 0)
      const nuevoStock = parseFloat((stockActual + cantidad).toFixed(3))
      tx.update(productoRef, {
        stock: nuevoStock,
        precio_compra: Number(data.precio_compra),
        ...(Number(data.precio_venta) > 0 ? { precio_venta: Number(data.precio_venta) } : {}),
        ultima_actualizacion: serverTimestamp(),
      })

      const compraRef = doc(collection(db, 'compras'))
      tx.set(compraRef, {
        fecha:         serverTimestamp(),
        nombre:        nombreNormalizado,
        cantidad,
        presentacion:  data.presentacion || '',
        precio_compra: Number(data.precio_compra),
        precio_venta:  Number(data.precio_venta) || 0,
        total:         Number(data.precio_compra) * cantidad,
        proveedor:     (data.proveedor || '').toUpperCase(),
        id_usuario:    authStore.user?.uid || null,
        usuario_email: authStore.user?.email || null,
        origen:        'manual',
        producto_id:   productoRef.id,
      })
    })
    metrics.trackReadEstimate('compras.registrarCompra.tx', 1)
    metrics.trackWriteEstimate('compras.registrarCompra.tx', 2)
  }

  async function actualizarCompra(id, data) {
    const authStore = useAuthStore()
    const metrics = useUsageMetricsStore()
    await runTransaction(db, async (tx) => {
      const compraRef = doc(db, 'compras', id)
      const compraSnap = await tx.get(compraRef)
      if (!compraSnap.exists()) throw new Error('La compra no existe')

      const compraActual = compraSnap.data() || {}
      const cantidadAnterior = Number(compraActual.cantidad ?? 0)
      const cantidadNueva = Number(data.cantidad ?? cantidadAnterior)
      const deltaCantidad = parseFloat((cantidadNueva - cantidadAnterior).toFixed(3))

      let productoRef = null
      if (compraActual.producto_id) {
        productoRef = doc(db, 'productos', compraActual.producto_id)
        const productoSnap = await tx.get(productoRef)
        if (!productoSnap.exists()) productoRef = null
      }

      if (!productoRef) {
        const nombreBusqueda = String(data.nombre ?? compraActual.nombre ?? '').trim().toUpperCase()
        const qProd = query(
          collection(db, 'productos'),
          where('nombre', '==', nombreBusqueda),
          limit(1),
        )
        const prodSnap = await tx.get(qProd)
        if (!prodSnap.empty) productoRef = prodSnap.docs[0].ref
      }

      if (!productoRef) throw new Error('No se encontró el producto para actualizar stock')

      const productoSnap = await tx.get(productoRef)
      const stockActual = Number(productoSnap.data()?.stock ?? 0)
      const nuevoStock = parseFloat((stockActual + deltaCantidad).toFixed(3))
      if (nuevoStock < 0) throw new Error('El ajuste deja stock negativo')

      tx.update(productoRef, {
        stock: nuevoStock,
        precio_compra: Number(data.precio_compra ?? compraActual.precio_compra ?? 0),
        ...(Number(data.precio_venta ?? compraActual.precio_venta ?? 0) > 0
          ? { precio_venta: Number(data.precio_venta ?? compraActual.precio_venta) }
          : {}),
        ultima_actualizacion: serverTimestamp(),
      })

      tx.update(compraRef, {
        ...data,
        total:         Number(data.precio_compra ?? compraActual.precio_compra ?? 0) * cantidadNueva,
        producto_id:   productoRef.id,
        editado_en:    serverTimestamp(),
        editado_por:   authStore.user?.uid || null,
        editado_email: authStore.user?.email || null,
      })
    })
    metrics.trackReadEstimate('compras.actualizarCompra.tx', 2)
    metrics.trackWriteEstimate('compras.actualizarCompra.tx', 2)
  }

  async function eliminarCompra(id) {
    const authStore = useAuthStore()
    const metrics = useUsageMetricsStore()
    await runTransaction(db, async (tx) => {
      const compraRef = doc(db, 'compras', id)
      const compraSnap = await tx.get(compraRef)
      if (!compraSnap.exists()) throw new Error('La compra no existe')

      const compra = compraSnap.data() || {}
      if ((compra.estado || 'activa') === 'anulada') return

      let productoRef = null
      if (compra.producto_id) {
        productoRef = doc(db, 'productos', compra.producto_id)
        const productoSnap = await tx.get(productoRef)
        if (!productoSnap.exists()) productoRef = null
      }

      if (!productoRef) {
        const qProd = query(
          collection(db, 'productos'),
          where('nombre', '==', String(compra.nombre || '').trim().toUpperCase()),
          limit(1),
        )
        const prodSnap = await tx.get(qProd)
        if (!prodSnap.empty) productoRef = prodSnap.docs[0].ref
      }

      if (!productoRef) throw new Error('No se encontró el producto para actualizar stock')

      const cantidad = Number(compra.cantidad ?? 0)
      const productoSnap = await tx.get(productoRef)
      const stockActual = Number(productoSnap.data()?.stock ?? 0)
      const nuevoStock = parseFloat((stockActual - cantidad).toFixed(3))
      if (nuevoStock < 0) throw new Error('No hay stock suficiente para anular la compra')

      tx.update(productoRef, {
        stock: nuevoStock,
        ultima_actualizacion: serverTimestamp(),
      })

      tx.update(compraRef, {
        estado:         'anulada',
        anulada_en:     serverTimestamp(),
        anulada_por:    authStore.user?.uid || null,
        anulada_email:  authStore.user?.email || null,
      })
    })
    metrics.trackReadEstimate('compras.eliminarCompra.tx', 2)
    metrics.trackWriteEstimate('compras.eliminarCompra.tx', 2)
  }

  return {
    compras,
    comprasActivas,
    totalPeriodo,
    porProveedor,
    subscribeByPeriodo,
    initPeriodo,
    loadMorePeriodo,
    hasMorePeriodo,
    loadingPeriodo,
    loadingMorePeriodo,
    registrarCompra,
    actualizarCompra,
    eliminarCompra,
  }
})
