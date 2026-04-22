import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, addDoc, updateDoc, doc, increment, serverTimestamp,
  query, orderBy, limit, onSnapshot, where, Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase/firebaseConfig'
import { useAuthStore } from '@/stores/useAuthStore'
import { METODOS_PAGO } from '@/firebase/constants'

export const useVentasStore = defineStore('ventas', () => {
  const ventas      = ref([])
  const carrito     = ref([])
  const metodoPago  = ref('efectivo')

  const ventasActivas = computed(() =>
    ventas.value.filter(v => (v.estado || 'activa') !== 'anulada'),
  )

  // ─── Computed ──────────────────────────────────────────────────────────────
  const subtotal = computed(() =>
    carrito.value.reduce((sum, item) => sum + (item.precio ?? 0) * (item.qty ?? 0), 0),
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
      const nuevaQty = parseFloat((existe.qty + qty).toFixed(3))
      existe.qty = nuevaQty
      if (!granel && nuevaQty % 1 !== 0) existe.es_fraccionado = true
    } else {
      carrito.value.push({
        id:             producto.id,
        nombre:         producto.nombre,
        precio:         producto.precio_venta,
        qty:            parseFloat(qty.toFixed ? qty.toFixed(3) : qty),
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
    await addDoc(collection(db, 'ventas'), {
      fecha:          serverTimestamp(),
      items:          carrito.value.map(i => ({
        id:     i.id,
        nombre: i.nombre,
        qty:    i.qty,
        precio: i.precio,
      })),
      subtotal:       subtotal.value,
      recargo_metodo: recargoMetodo.value,
      total:          total.value,
      metodo_pago:    metodoPago.value,
      id_usuario:     authStore.user?.uid,
      estado:         'activa',
    })

    limpiarCarrito()
  }

  async function actualizarVenta(id, data) {
    const authStore = useAuthStore()
    const payload = { ...data }
    let deltaQty = 0
    let productoId = null

    if (payload.cantidad != null) {
      const ventaActual = ventas.value.find(v => v.id === id)
      const itemsActuales = Array.isArray(ventaActual?.items) ? [...ventaActual.items] : []
      const item0 = itemsActuales[0]
      const nuevaCantidad = Number(payload.cantidad)
      delete payload.cantidad

      if (item0 && nuevaCantidad > 0) {
        const qtyNormalizada = parseFloat(nuevaCantidad.toFixed(3))
        const qtyAnterior = Number(item0.qty ?? 0)
        deltaQty = parseFloat((qtyNormalizada - qtyAnterior).toFixed(3))
        productoId = item0.id || null
        itemsActuales[0] = { ...item0, qty: qtyNormalizada }
        payload.items = itemsActuales
      }
    }

    await updateDoc(doc(db, 'ventas', id), {
      ...payload,
      editado_en: serverTimestamp(),
      editado_por: authStore.user?.uid || null,
      editado_por_email: authStore.user?.email || null,
    })

    if (productoId && deltaQty !== 0) {
      await updateDoc(doc(db, 'productos', productoId), {
        stock: increment(-deltaQty),
        ultima_actualizacion: serverTimestamp(),
      })
    }
  }

  async function eliminarVenta(id) {
    const authStore = useAuthStore()
    await updateDoc(doc(db, 'ventas', id), {
      estado: 'anulada',
      anulada_en: serverTimestamp(),
      anulada_por: authStore.user?.uid || null,
      anulada_por_email: authStore.user?.email || null,
    })
  }

  // ─── Listener en tiempo real (últimas 50 ventas) ──────────────────────────
  function subscribe() {
    const q = query(collection(db, 'ventas'), orderBy('fecha', 'desc'), limit(50))
    return onSnapshot(q, snap => {
      ventas.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    })
  }

  // ─── Listener filtrado por período (mes completo) ─────────────────────────
  function subscribeByPeriodo(inicio, fin, onReady) {
    const q = query(
      collection(db, 'ventas'),
      where('fecha', '>=', Timestamp.fromDate(inicio)),
      where('fecha', '<=', Timestamp.fromDate(fin)),
      orderBy('fecha', 'desc'),
    )
    return onSnapshot(q, snap => {
      ventas.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      onReady?.()
    })
  }

  return {
    ventas,
    ventasActivas,
    carrito,
    metodoPago,
    subtotal,
    recargoMetodo,
    total,
    agregarAlCarrito,
    quitarDelCarrito,
    limpiarCarrito,
    registrarVenta,
    actualizarVenta,
    eliminarVenta,
    subscribe,
    subscribeByPeriodo,
  }
})
