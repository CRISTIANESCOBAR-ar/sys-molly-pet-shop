import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/firebase/firebaseConfig'

export const useAuthStore = defineStore('auth', () => {
  const user    = ref(null)  // { uid, email, role }
  const loading = ref(true)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin         = computed(() => user.value?.role === 'admin')
  const isCajero        = computed(() => !!user.value) // admin también puede cajear

  // Inicializa el listener de Auth; llamar en App.vue antes de montar el router
  function init() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const tokenResult = await firebaseUser.getIdTokenResult()
          user.value = {
            uid:   firebaseUser.uid,
            email: firebaseUser.email,
            role:  tokenResult.claims.role || 'cajero',
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
    user.value = {
      uid:   credential.user.uid,
      email: credential.user.email,
      role:  tokenResult.claims.role || 'cajero',
    }
  }

  async function logout() {
    await signOut(auth)
    user.value = null
  }

  return { user, loading, isAuthenticated, isAdmin, isCajero, init, login, logout }
})
