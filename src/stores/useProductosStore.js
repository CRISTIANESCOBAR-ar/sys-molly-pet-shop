import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, onSnapshot,
} from 'firebase/firestore'
import { db } from '@/firebase/firebaseConfig'
import { DIAS_PRECIO_DESACTUALIZADO } from '@/firebase/constants'
import { useUsageMetricsStore } from '@/stores/useUsageMetricsStore'

export const useProductosStore = defineStore('productos', () => {
  const productos = ref([])
  const loading   = ref(false)
  let unsubProductos = null
  let consumidoresActivos = 0

  // ─── Computed ──────────────────────────────────────────────────────────────
  const productosConStockBajo = computed(() =>
    productos.value.filter(p => p.stock <= p.stock_minimo),
  )

  const productosConPrecioViejo = computed(() => {
    const limite = DIAS_PRECIO_DESACTUALIZADO * 24 * 60 * 60 * 1000
    const ahora  = Date.now()
    return productos.value.filter(p => {
      if (!p.ultima_actualizacion) return true
      const ts = p.ultima_actualizacion?.toDate
        ? p.ultima_actualizacion.toDate()
        : new Date(p.ultima_actualizacion)
      return (ahora - ts.getTime()) > limite
    })
  })

  // ─── Listener en tiempo real ───────────────────────────────────────────────
  function subscribe() {
    consumidoresActivos += 1
    if (!unsubProductos) {
      const metrics = useUsageMetricsStore()
      const q = query(collection(db, 'productos'), orderBy('nombre'))
      metrics.trackListenerStart('productos.subscribe')
      unsubProductos = onSnapshot(q, (snap) => {
        // Estimacion de lecturas en listener: carga inicial + cambios posteriores
        const cambios = snap.docChanges()
        const esCargaInicial = productos.value.length === 0
        metrics.trackReadEstimate(
          'productos.subscribe',
          esCargaInicial ? snap.docs.length : cambios.length,
        )

      // Carga inicial: reemplaza todo
        if (snap.metadata.hasPendingWrites === false && cambios.some(c => c.type === 'added') && productos.value.length === 0) {
          productos.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          return
        }
        // Actualizaciones incrementales: solo aplica cambios para minimizar lecturas
        const actuales = [...productos.value]
        cambios.forEach(change => {
          const dato = { id: change.doc.id, ...change.doc.data() }
          if (change.type === 'added') {
            if (!actuales.find(p => p.id === dato.id)) actuales.push(dato)
          } else if (change.type === 'modified') {
            const idx = actuales.findIndex(p => p.id === dato.id)
            if (idx !== -1) actuales[idx] = dato
          } else if (change.type === 'removed') {
            const idx = actuales.findIndex(p => p.id === dato.id)
            if (idx !== -1) actuales.splice(idx, 1)
          }
        })
        productos.value = [...actuales]
      })

    }

    return () => {
      consumidoresActivos = Math.max(0, consumidoresActivos - 1)
      if (consumidoresActivos === 0 && unsubProductos) {
        const metrics = useUsageMetricsStore()
        unsubProductos()
        unsubProductos = null
        metrics.trackListenerStop('productos.subscribe')
      }
    }
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────
  async function agregar(data) {
    const metrics = useUsageMetricsStore()
    loading.value = true
    try {
      await addDoc(collection(db, 'productos'), {
        sku:                data.sku || '',
        nombre:             data.nombre,
        categoria:          data.categoria,
        proveedor:          data.proveedor || '',
        precio_compra:      data.precio_compra ?? 0,
        precio_venta:       data.precio_venta ?? 0,
        stock:              data.stock ?? 0,
        stock_minimo:       data.stock_minimo ?? 0,
        img_url:            data.img_url || '',
        timestamp:          serverTimestamp(),
        ultima_actualizacion: serverTimestamp(),
      })
      metrics.trackWriteEstimate('productos.agregar', 1)
    } finally {
      loading.value = false
    }
  }

  async function actualizar(id, data) {
    const metrics = useUsageMetricsStore()
    await updateDoc(doc(db, 'productos', id), {
      ...data,
      ultima_actualizacion: serverTimestamp(),
    })
    metrics.trackWriteEstimate('productos.actualizar', 1)
  }

  async function actualizarStock(id, nuevoStock) {
    const metrics = useUsageMetricsStore()
    await updateDoc(doc(db, 'productos', id), {
      stock: nuevoStock,
      ultima_actualizacion: serverTimestamp(),
    })
    metrics.trackWriteEstimate('productos.actualizarStock', 1)
  }

  async function eliminar(id) {
    const metrics = useUsageMetricsStore()
    await deleteDoc(doc(db, 'productos', id))
    metrics.trackWriteEstimate('productos.eliminar', 1)
  }

  return {
    productos,
    loading,
    productosConStockBajo,
    productosConPrecioViejo,
    subscribe,
    agregar,
    actualizar,
    actualizarStock,
    eliminar,
  }
})
