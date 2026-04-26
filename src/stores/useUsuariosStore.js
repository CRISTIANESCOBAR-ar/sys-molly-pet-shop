import { defineStore }            from 'pinia'
import { ref }                     from 'vue'
import {
  collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore'
import { sendPasswordResetEmail }  from 'firebase/auth'
import { db, auth, firebaseConfig }  from '@/firebase/firebaseConfig'

export const useUsuariosStore = defineStore('usuarios', () => {
  const usuarios = ref([])

  // ── Suscripción en tiempo real ────────────────────────────────────────────
  function subscribe() {
    return onSnapshot(collection(db, 'usuarios'), (snap) => {
      usuarios.value = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.email.localeCompare(b.email))
    })
  }

  // ── Crear nuevo usuario en Autenticación sin desloguear admin actual ────────
  async function crearUsuario({ email, password, nombre, role }) {
    const { initializeApp, deleteApp } = await import('firebase/app')
    const { getAuth, createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth')

    // App secundaria para evitar que el admin (usuario logueado) se cierre sesión
    const appName = `Secondary_${Date.now()}`
    const secondaryApp = initializeApp(firebaseConfig, appName)
    const secondaryAuth = getAuth(secondaryApp)

    try {
      // 1. Crear en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
      
      // 2. Opcional: Nombre visible
      if (nombre) {
        await updateProfile(userCredential.user, { displayName: nombre })
      }

      // 3. Guardar en Firestore para reglas y UI
      await guardarUsuario({ uid: userCredential.user.uid, email, nombre, role })

      // Cerrar sesión secundaria
      await secondaryAuth.signOut()
    } finally {
      // Limpiar app secundaria
      await deleteApp(secondaryApp)
    }
  }

  // ── Guardar o actualizar un usuario en Firestore ──────────────────────────
  async function guardarUsuario({ uid, email, nombre, role }) {
    await setDoc(doc(db, 'usuarios', uid), {
      uid,
      email,
      nombre: nombre || email,
      role,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }

  // ── Enviar email de restablecimiento de contraseña ────────────────────────
  async function enviarResetPassword(email) {
    await sendPasswordResetEmail(auth, email)
  }

  return { usuarios, subscribe, crearUsuario, guardarUsuario, enviarResetPassword }
})
