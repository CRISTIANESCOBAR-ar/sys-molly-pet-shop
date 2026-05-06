import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, updateDoc, doc, serverTimestamp, runTransaction,
  query, orderBy, limit, onSnapshot, where, Timestamp, getDocs, startAfter,
} from 'firebase/firestore'
import { db } from '@/firebase/firebaseConfig'
import { useAuthStore } from '@/stores/useAuthStore'
import { METODOS_PAGO } from '@/firebase/constants'
import { useUsageMetricsStore } from '@/stores/useUsageMetricsStore'

export const useVentasStore = defineStore('ventas', () => {
  const ventas      = ref([])
  const carrito     = ref([])
  const metodoPago  = ref('efectivo')
  const pageSize = 30
  const periodoActualKey = ref('')
  const periodoInicio = ref(null)
  const periodoFin = ref(null)
  const paginaLocal = ref(pageSize)
  const loadingPeriodo = ref(false)

  const ventasActivas = computed(() =>
    ventas.value.filter(v => (v.estado || 'activa') !== 'anulada'),
  )

  const ventasMostradas = computed(() =>
    ventasActivas.value.slice(0, paginaLocal.value),
  )

  const hasMorePeriodo = computed(() =>
    ventasActivas.value.length > paginaLocal.value,
  )

  // ─── Computed ──────────────────────────────────────────────────────────────
  const subtotal = computed(() =>
    carrito.value.reduce((sum, item) => sum + Math.round((item.precio ?? 0) * (item.qty ?? 0)), 0),
  )

  const recargoMetodo = computed(() => {
    const metodo = METODOS_PAGO.find(m => m.value === metodoPago.value)
    return metodo ? subtotal.value * metodo.recargo : 0
  })

  const total = computed(() => subtotal.value + recargoMetodo.value)

  function esGranel(producto) {
    return Boolean(producto?.venta_granel ?? producto?.granel ?? false)
  }

  // ─── Carrito ───────────────────────────────────────────────────────────────
  function agregarAlCarrito(producto, qty = 1) {
    const existe = carrito.value.find(i => i.id === producto.id)
    const granel = esGranel(producto)
    const esFraccionado = !granel && qty % 1 !== 0
    if (existe) {
      const nuevaQty = parseFloat((existe.qty + qty).toFixed(5))
      existe.qty = nuevaQty
      if (!granel && nuevaQty % 1 !== 0) existe.es_fraccionado = true
    } else {
      carrito.value.push({
        id:             producto.id,
        nombre:         producto.nombre,
        precio:         producto.precio_venta,
        qty:            parseFloat(qty.toFixed ? qty.toFixed(5) : qty),
        venta_granel:   granel,
        es_fraccionado: esFraccionado,
      })
    }
  }

  function quitarDelCarrito(productoId) {
    const idx = carrito.value.findIndex(i => i.id === productoId)
    if (idx === -1) return
    const item = carrito.value[idx]
    // Granel o fraccionado: elimina el ítem completo (sin decrementos parciales)
    if (item.venta_granel || item.es_fraccionado || item.qty <= 1) {
      carrito.value.splice(idx, 1)
    } else {
      item.qty--
    }
  }

  function limpiarCarrito() {
    carrito.value   = []
    metodoPago.value = 'efectivo'
  }

  // ─── Registro de venta ────────────────────────────────────────────────────
  async function registrarVenta() {
    if (carrito.value.length === 0) throw new Error('El carrito está vacío')

    const authStore = useAuthStore()
    const metrics = useUsageMetricsStore()
    const itemsVenta = carrito.value.map(i => ({
      id:     i.id,
      nombre: i.nombre,
      qty:    Number(i.qty ?? 0),
      precio: Number(i.precio ?? 0),
    }))

    await runTransaction(db, async (tx) => {
      // ── FASE 1: lecturas en paralelo ─────────────────────────────────────
      const productosRefs = itemsVenta.map(item => {
        if (!item.id || Number(item.qty ?? 0) <= 0) throw new Error('Ítem de venta inválido')
        return doc(db, 'productos', item.id)
      })
      const productosSnaps = await Promise.all(productosRefs.map(ref => tx.get(ref)))

      const snapshots = productosSnaps.map((snap, i) => {
        if (!snap.exists()) throw new Error(`Producto no encontrado: ${itemsVenta[i].nombre}`)
        const stockActual = Number(snap.data()?.stock ?? 0)
        const qty = Number(itemsVenta[i].qty ?? 0)
        if (stockActual < qty) throw new Error(`Stock insuficiente para ${itemsVenta[i].nombre}. Disponible: ${stockActual}`)
        return { ref: productosRefs[i], stockActual, qty }
      })

      // ── FASE 2: escrituras ───────────────────────────────────────────────
      for (const { ref, stockActual, qty } of snapshots) {
        tx.update(ref, {
          stock: parseFloat((stockActual - qty).toFixed(3)),
          ultima_actualizacion: serverTimestamp(),
        })
      }

      const ventaRef = doc(collection(db, 'ventas'))
      tx.set(ventaRef, {
        fecha:          serverTimestamp(),
        items:          itemsVenta,
        subtotal:       subtotal.value,
        recargo_metodo: recargoMetodo.value,
        total:          total.value,
        metodo_pago:    metodoPago.value,
        id_usuario:     authStore.user?.uid,
        usuario_email:  authStore.user?.email || null,
        estado:         'activa',
      })
    })
    metrics.trackReadEstimate('ventas.registrarVenta.tx', itemsVenta.length)
    metrics.trackWriteEstimate('ventas.registrarVenta.tx', itemsVenta.length + 1)

    // Agregar la nueva venta al historial local inmediatamente (sin recargar Firestore)
    const ahora = new Date()
    ventas.value.unshift({
      id: `local-${Date.now()}`,
      fecha: { toDate: () => ahora },
      items: itemsVenta,
      subtotal: subtotal.value,
      recargo_metodo: recargoMetodo.value,
      total: total.value,
      metodo_pago: metodoPago.value,
      id_usuario: authStore.user?.uid,
      usuario_email: authStore.user?.email || null,
      estado: 'activa',
    })

    limpiarCarrito()
  }

  async function actualizarVenta(id, data) {
    const authStore = useAuthStore()
    const metrics = useUsageMetricsStore()
    await runTransaction(db, async (tx) => {
      const ventaRef = doc(db, 'ventas', id)
      const ventaSnap = await tx.get(ventaRef)
      if (!ventaSnap.exists()) throw new Error('La venta no existe')

      const ventaActual = ventaSnap.data() || {}
      const payload = { ...data }

      if (payload.cantidad != null) {
        const itemsActuales = Array.isArray(ventaActual.items) ? [...ventaActual.items] : []
        const item0 = itemsActuales[0]
        const nuevaCantidad = Number(payload.cantidad)
        delete payload.cantidad

        if (item0 && nuevaCantidad > 0) {
          const qtyNormalizada = parseFloat(nuevaCantidad.toFixed(3))
          const qtyAnterior = Number(item0.qty ?? 0)
          const deltaQty = parseFloat((qtyNormalizada - qtyAnterior).toFixed(3))
          const productoId = item0.id || null

          if (productoId && deltaQty !== 0) {
            const productoRef = doc(db, 'productos', productoId)
            const productoSnap = await tx.get(productoRef)
            if (!productoSnap.exists()) throw new Error(`Producto no encontrado: ${item0.nombre || productoId}`)

            const stockActual = Number(productoSnap.data()?.stock ?? 0)
            const nuevoStock = parseFloat((stockActual - deltaQty).toFixed(3))
            if (nuevoStock < 0) {
              throw new Error(`Stock insuficiente para ${item0.nombre || 'el producto'}`)
            }

            tx.update(productoRef, {
              stock: nuevoStock,
              ultima_actualizacion: serverTimestamp(),
            })
          }

          itemsActuales[0] = {
            ...item0,
            qty: qtyNormalizada,
            ...(payload.nombre != null ? { nombre: String(payload.nombre).trim().toUpperCase() } : {}),
            ...(payload.precio != null ? { precio: Number(payload.precio) } : {}),
          }
          payload.items = itemsActuales
        }
      }

      // Si la cantidad no cambió pero sí el nombre o precio, actualizar items igual
      if (payload.nombre != null || payload.precio != null) {
        if (!payload.items) {
          const itemsActuales = Array.isArray(ventaActual.items) ? [...ventaActual.items] : []
          if (itemsActuales[0]) {
            itemsActuales[0] = {
              ...itemsActuales[0],
              ...(payload.nombre != null ? { nombre: String(payload.nombre).trim().toUpperCase() } : {}),
              ...(payload.precio != null ? { precio: Number(payload.precio) } : {}),
            }
            payload.items = itemsActuales
          }
        }
      }
      delete payload.nombre
      delete payload.precio

      tx.update(ventaRef, {
        ...payload,
        editado_en: serverTimestamp(),
        editado_por: authStore.user?.uid || null,
        editado_por_email: authStore.user?.email || null,
      })
    })
    metrics.trackReadEstimate('ventas.actualizarVenta.tx', 1)
    metrics.trackWriteEstimate('ventas.actualizarVenta.tx', 1)
  }

  // ─── Registro desde cola offline ─────────────────────────────────────────
  async function registrarVentaDesdePayload(payload) {
    const authStore = useAuthStore()
    const metrics = useUsageMetricsStore()
    const { items, metodo_pago, subtotal: sub, recargo_metodo, total: tot } = payload

    await runTransaction(db, async (tx) => {
      // ── FASE 1: lecturas en paralelo ─────────────────────────────────────
      const productosRefs = items.map(item => {
        if (!item.id || Number(item.qty ?? 0) <= 0) throw new Error('Ítem de venta inválido')
        return doc(db, 'productos', item.id)
      })
      const productosSnaps = await Promise.all(productosRefs.map(ref => tx.get(ref)))

      const snapshots = productosSnaps.map((snap, i) => {
        if (!snap.exists()) throw new Error(`Producto no encontrado: ${items[i].nombre}`)
        const stockActual = Number(snap.data()?.stock ?? 0)
        const qty = Number(items[i].qty ?? 0)
        if (stockActual < qty) throw new Error(`Stock insuficiente para ${items[i].nombre}`)
        return { ref: productosRefs[i], stockActual, qty }
      })

      // ── FASE 2: escrituras ───────────────────────────────────────────────
      for (const { ref, stockActual, qty } of snapshots) {
        tx.update(ref, {
          stock: parseFloat((stockActual - qty).toFixed(3)),
          ultima_actualizacion: serverTimestamp(),
        })
      }

      const ventaRef = doc(collection(db, 'ventas'))
      tx.set(ventaRef, {
        fecha:          serverTimestamp(),
        items,
        subtotal:       Number(sub) || 0,
        recargo_metodo: Number(recargo_metodo) || 0,
        total:          Number(tot) || 0,
        metodo_pago:    metodo_pago || 'efectivo',
        id_usuario:     payload.id_usuario || authStore.user?.uid || null,
        estado:         'activa',
        origen:         'offline_queue',
      })
    })
    metrics.trackReadEstimate('ventas.registrarVentaDesdePayload.tx', items.length)
    metrics.trackWriteEstimate('ventas.registrarVentaDesdePayload.tx', items.length + 1)
  }

  async function eliminarVenta(id) {
    const authStore = useAuthStore()
    const metrics = useUsageMetricsStore()
    await runTransaction(db, async (tx) => {
      const ventaRef = doc(db, 'ventas', id)
      const ventaSnap = await tx.get(ventaRef)
      if (!ventaSnap.exists()) throw new Error('La venta no existe')

      const venta = ventaSnap.data() || {}
      if ((venta.estado || 'activa') === 'anulada') return

      const items = Array.isArray(venta.items) ? venta.items : []
      for (const item of items) {
        const qty = Number(item?.qty ?? 0)
        if (!item?.id || qty <= 0) continue

        const productoRef = doc(db, 'productos', item.id)
        const productoSnap = await tx.get(productoRef)
        if (!productoSnap.exists()) continue

        const stockActual = Number(productoSnap.data()?.stock ?? 0)
        const nuevoStock = parseFloat((stockActual + qty).toFixed(3))
        tx.update(productoRef, {
          stock: nuevoStock,
          ultima_actualizacion: serverTimestamp(),
        })
      }

      tx.update(ventaRef, {
        estado: 'anulada',
        anulada_en: serverTimestamp(),
        anulada_por: authStore.user?.uid || null,
        anulada_por_email: authStore.user?.email || null,
      })
    })
    metrics.trackReadEstimate('ventas.eliminarVenta.tx', 1)
    metrics.trackWriteEstimate('ventas.eliminarVenta.tx', 1)
  }

  // ─── Listener en tiempo real (últimas 50 ventas) ──────────────────────────
  function subscribe() {
    const metrics = useUsageMetricsStore()
    const q = query(collection(db, 'ventas'), orderBy('fecha', 'desc'), limit(50))
    metrics.trackListenerStart('ventas.subscribe')
    const unsub = onSnapshot(q, snap => {
      metrics.trackReadEstimate('ventas.subscribe', snap.docs.length)
      ventas.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    })
    return () => {
      unsub()
      metrics.trackListenerStop('ventas.subscribe')
    }
  }

  // ─── Paginación por período: carga el mes completo y pagina localmente ────────
  async function initPeriodo(inicio, fin, options = {}) {
    const force = Boolean(options.force)
    const key = `${inicio.getTime()}-${fin.getTime()}`
    if (!force && periodoActualKey.value === key && ventas.value.length > 0) return

    periodoActualKey.value = key
    periodoInicio.value = inicio
    periodoFin.value = fin
    paginaLocal.value = pageSize
    ventas.value = []

    loadingPeriodo.value = true
    try {
      const metrics = useUsageMetricsStore()
      const q = query(
        collection(db, 'ventas'),
        where('fecha', '>=', Timestamp.fromDate(inicio)),
        where('fecha', '<=', Timestamp.fromDate(fin)),
        orderBy('fecha', 'desc'),
      )
      const snap = await getDocs(q)
      ventas.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      metrics.trackReadEstimate('ventas.periodo', snap.docs.length)
    } finally {
      loadingPeriodo.value = false
    }
  }

  function loadMorePeriodo() {
    paginaLocal.value += pageSize
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

  return {
    ventas,
    ventasActivas,
    ventasMostradas,
    carrito,
    metodoPago,
    subtotal,
    recargoMetodo,
    total,
    agregarAlCarrito,
    quitarDelCarrito,
    limpiarCarrito,
    registrarVenta,
    registrarVentaDesdePayload,
    actualizarVenta,
    eliminarVenta,
    subscribe,
    subscribeByPeriodo,
    initPeriodo,
    loadMorePeriodo,
    hasMorePeriodo,
    loadingPeriodo,
  }
})
