import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, onSnapshot,
} from 'firebase/firestore'
import { db } from '@/firebase/firebaseConfig'
import { DIAS_PRECIO_DESACTUALIZADO } from '@/firebase/constants'

export const useProductosStore = defineStore('productos', () => {
  const productos = ref([])
  const loading   = ref(false)

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
    const q = query(collection(db, 'productos'), orderBy('nombre'))
    return onSnapshot(q, (snap) => {
      productos.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    })
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────
  async function agregar(data) {
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
    } finally {
      loading.value = false
    }
  }

  async function actualizar(id, data) {
    await updateDoc(doc(db, 'productos', id), {
      ...data,
      ultima_actualizacion: serverTimestamp(),
    })
  }

  async function actualizarStock(id, nuevoStock) {
    await updateDoc(doc(db, 'productos', id), {
      stock: nuevoStock,
      ultima_actualizacion: serverTimestamp(),
    })
  }

  async function eliminar(id) {
    await deleteDoc(doc(db, 'productos', id))
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
