import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, runTransaction,
  query, orderBy, onSnapshot, where, limit, getDocs,
} from 'firebase/firestore'
import { db } from '@/firebase/firebaseConfig'

export const useProveedoresStore = defineStore('proveedores', () => {
  const proveedores   = ref([])
  const cuentasPagar  = ref([])
  const loading       = ref(false)

  function normalizarNombreProveedor(valor) {
    const limpio = String(valor || '')
      .trim()
      .toUpperCase()
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')

    if (/^F\s*Y\s*P$/.test(limpio)) return 'FY P'
    return limpio
  }

  function normalizarWebInstagram(valor) {
    return String(valor || '').trim()
  }

  // ─── Listeners en tiempo real ──────────────────────────────────────────────
  function subscribeProveedores() {
    const q = query(collection(db, 'proveedores'), orderBy('nombre'))
    return onSnapshot(q, snap => {
      proveedores.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    })
  }

  function subscribeCuentasPagar() {
    const q = query(collection(db, 'cuentas_pagar'), orderBy('fecha_vencimiento'))
    return onSnapshot(q, snap => {
      cuentasPagar.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    })
  }

  // ─── Proveedores CRUD ──────────────────────────────────────────────────────
  async function agregarProveedor(data) {
    const nombreNormalizado = normalizarNombreProveedor(data.nombre)
    if (!nombreNormalizado) throw new Error('Nombre de proveedor inválido')

    const contacto = String(data.contacto || '').trim()
    const web_instagram = normalizarWebInstagram(data.web_instagram)

    const q = query(
      collection(db, 'proveedores'),
      where('nombre', '==', nombreNormalizado),
      limit(1),
    )
    const existente = await getDocs(q)

    if (!existente.empty) {
      const docExistente = existente.docs[0]
      const payload = docExistente.data()
      const patch = {}

      if (!payload.contacto && contacto) patch.contacto = contacto
      if (!payload.web_instagram && web_instagram) patch.web_instagram = web_instagram

      if (Object.keys(patch).length) {
        await updateDoc(docExistente.ref, patch)
      }
      return docExistente.id
    }

    const ref = await addDoc(collection(db, 'proveedores'), {
      nombre:          nombreNormalizado,
      contacto,
      web_instagram,
      saldo_pendiente: 0,
    })

    return ref.id
  }

  async function actualizarProveedor(id, data) {
    const patch = { ...data }
    if ('nombre' in patch) patch.nombre = normalizarNombreProveedor(patch.nombre)
    if ('web_instagram' in patch) patch.web_instagram = normalizarWebInstagram(patch.web_instagram)
    if ('contacto' in patch) patch.contacto = String(patch.contacto || '').trim()
    await updateDoc(doc(db, 'proveedores', id), patch)
  }

  async function eliminarProveedor(id) {
    await deleteDoc(doc(db, 'proveedores', id))
  }

  // ─── Cuentas a Pagar ──────────────────────────────────────────────────────
  // Crea la cuenta Y suma al saldo del proveedor en una transacción atómica
  async function crearCuentaPagar({ id_proveedor, nro_factura, monto_total, fecha_vencimiento }) {
    loading.value = true
    try {
      const proveedorRef = doc(db, 'proveedores', id_proveedor)
      const cuentaRef    = doc(collection(db, 'cuentas_pagar'))

      await runTransaction(db, async (tx) => {
        const provSnap = await tx.get(proveedorRef)
        if (!provSnap.exists()) throw new Error('Proveedor no encontrado')

        const saldoActual = provSnap.data().saldo_pendiente || 0

        tx.set(cuentaRef, {
          id_proveedor,
          nro_factura,
          monto_total,
          fecha_vencimiento,
          estado:              'pendiente',
          ultima_actualizacion: serverTimestamp(),
        })

        tx.update(proveedorRef, {
          saldo_pendiente: saldoActual + monto_total,
        })
      })
    } finally {
      loading.value = false
    }
  }

  // Marca la cuenta como pagada Y resta del saldo del proveedor
  async function pagarCuenta(cuentaId, id_proveedor, monto_total) {
    loading.value = true
    try {
      const proveedorRef = doc(db, 'proveedores', id_proveedor)
      const cuentaRef    = doc(db, 'cuentas_pagar', cuentaId)

      await runTransaction(db, async (tx) => {
        const provSnap = await tx.get(proveedorRef)
        if (!provSnap.exists()) throw new Error('Proveedor no encontrado')

        const saldoActual = provSnap.data().saldo_pendiente || 0

        tx.update(cuentaRef, {
          estado:              'pagado',
          ultima_actualizacion: serverTimestamp(),
        })

        tx.update(proveedorRef, {
          saldo_pendiente: Math.max(0, saldoActual - monto_total),
        })
      })
    } finally {
      loading.value = false
    }
  }

  return {
    proveedores,
    cuentasPagar,
    loading,
    subscribeProveedores,
    subscribeCuentasPagar,
    agregarProveedor,
    actualizarProveedor,
    eliminarProveedor,
    crearCuentaPagar,
    pagarCuenta,
  }
})
