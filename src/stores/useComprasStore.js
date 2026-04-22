import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, addDoc, updateDoc, doc, serverTimestamp,
  query, orderBy, onSnapshot, where, Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase/firebaseConfig'
import { useAuthStore } from '@/stores/useAuthStore'

export const useComprasStore = defineStore('compras', () => {
  const compras = ref([])

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

  // ─── Listener filtrado por período ────────────────────────────────────────
  function subscribeByPeriodo(inicio, fin, onReady) {
    const q = query(
      collection(db, 'compras'),
      where('fecha', '>=', Timestamp.fromDate(inicio)),
      where('fecha', '<=', Timestamp.fromDate(fin)),
      orderBy('fecha', 'desc'),
    )
    return onSnapshot(q, snap => {
      compras.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      onReady?.()
    })
  }

  // ─── Registrar nueva compra ───────────────────────────────────────────────
  async function registrarCompra(data) {
    const authStore = useAuthStore()

    await addDoc(collection(db, 'compras'), {
      fecha:         serverTimestamp(),
      nombre:        data.nombre.trim().toUpperCase(),
      cantidad:      data.cantidad,
      presentacion:  data.presentacion || '',
      precio_compra: data.precio_compra,
      precio_venta:  data.precio_venta,
      total:         data.precio_compra * data.cantidad,
      proveedor:     (data.proveedor || '').toUpperCase(),
      id_usuario:    authStore.user?.uid || null,
      usuario_email: authStore.user?.email || null,
      origen:        'manual',
    })
  }

  async function actualizarCompra(id, data) {
    const authStore = useAuthStore()
    await updateDoc(doc(db, 'compras', id), {
      ...data,
      editado_en:    serverTimestamp(),
      editado_por:   authStore.user?.uid || null,
      editado_email: authStore.user?.email || null,
    })
  }

  async function eliminarCompra(id) {
    const authStore = useAuthStore()
    await updateDoc(doc(db, 'compras', id), {
      estado:         'anulada',
      anulada_en:     serverTimestamp(),
      anulada_por:    authStore.user?.uid || null,
      anulada_email:  authStore.user?.email || null,
    })
  }

  return {
    compras,
    comprasActivas,
    totalPeriodo,
    porProveedor,
    subscribeByPeriodo,
    registrarCompra,
    actualizarCompra,
    eliminarCompra,
  }
})
