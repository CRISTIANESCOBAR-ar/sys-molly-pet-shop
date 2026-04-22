<script setup>
import { ref, reactive, computed } from 'vue'
import { useAuthStore } from '@/stores/useAuthStore'
import { useRouter }    from 'vue-router'

const authStore = useAuthStore()
const router    = useRouter()

const form    = reactive({ email: '', password: '' })
const loading = ref(false)
const errorMsg = ref('')

// ─── Validaciones reactivas ─────────────────────────────────────────────────
const emailValido    = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
const passwordValida = computed(() => form.password.length >= 6)
const puedeSubmit    = computed(() => emailValido.value && passwordValida.value && !loading.value)

async function handleLogin() {
  if (!puedeSubmit.value) return
  loading.value  = true
  errorMsg.value = ''
  try {
    await authStore.login(form.email, form.password)
    router.push('/ventas')
  } catch {
    errorMsg.value = 'Email o contraseña incorrectos'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-green-50 flex items-center justify-center p-4">
    <div class="w-full max-w-sm">

      <!-- Logo / header -->
      <div class="text-center mb-8">
        <div class="text-6xl mb-3">🐾</div>
        <h1 class="text-2xl font-bold text-gray-800">Molly Petshop</h1>
        <p class="text-sm text-gray-500 mt-1">Sistema de gestión</p>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <h2 class="text-base font-semibold text-gray-700 mb-5">Iniciar sesión</h2>

        <form @submit.prevent="handleLogin" class="space-y-4" novalidate>
          <!-- Email -->
          <div>
            <label class="text-xs font-medium text-gray-500 block mb-1">Email</label>
            <input
              v-model="form.email"
              type="email"
              autocomplete="email"
              placeholder="usuario@mollypetshop.com"
              :class="[
                'w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-colors',
                form.email && !emailValido
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200',
              ]"
            />
          </div>

          <!-- Contraseña -->
          <div>
            <label class="text-xs font-medium text-gray-500 block mb-1">Contraseña</label>
            <input
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              :class="[
                'w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-colors',
                form.password && !passwordValida
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200',
              ]"
            />
          </div>

          <!-- Error -->
          <p v-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</p>

          <button
            type="submit"
            :disabled="!puedeSubmit"
            class="w-full py-3 bg-green-500 text-white font-semibold rounded-xl text-sm disabled:opacity-50 hover:bg-green-600 active:bg-green-700 transition-colors"
          >
            {{ loading ? 'Ingresando...' : 'Ingresar' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
