import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/firebaseConfig'

export const useAuthStore = defineStore('auth', () => {
  const user    = ref(null)  // { uid, email, role }
  const loading = ref(true)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin         = computed(() => user.value?.role === 'admin')
  const isCajero        = computed(() => !!user.value) // admin también puede cajear

  async function resolveRole(firebaseUser, tokenResult) {
    if (tokenResult.claims.role) return tokenResult.claims.role
    // Fallback: leer de doc en auth para usuarios creados vía UI
    try {
      const snap = await getDoc(doc(db, 'usuarios', firebaseUser.uid))
      if (snap.exists() && snap.data().role) return snap.data().role
    } catch {} // ignorar error si no existe
    return 'cajero'
  }

  // Inicializa el listener de Auth; llamar en App.vue antes de montar el router
  function init() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const tokenResult = await firebaseUser.getIdTokenResult()
          const role = await resolveRole(firebaseUser, tokenResult)
          user.value = {
            uid:   firebaseUser.uid,
            email: firebaseUser.email,
            role,
          }
        } else {
          user.value = null
        }
        loading.value = false
        resolve()
      })
    })
  }

  async function login(email, password) {
    const credential  = await signInWithEmailAndPassword(auth, email, password)
    const tokenResult = await credential.user.getIdTokenResult()
    const role = await resolveRole(credential.user, tokenResult)
    user.value = {
      uid:   credential.user.uid,
      email: credential.user.email,
      role,
    }
  }

  async function logout() {
    await signOut(auth)
    user.value = null
  }

  return { user, loading, isAuthenticated, isAdmin, isCajero, init, login, logout }
})
