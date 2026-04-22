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
  <div class="login-fondo min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-sm">

      <!-- Logo / header -->
      <div class="text-center mb-7">
        <div class="molly-logo-wrap mx-auto mb-3">
          <img src="/Molly.png" alt="Molly Petshop" class="molly-logo-img" />
        </div>
        <h1 class="text-2xl font-bold text-white drop-shadow-sm">Molly Petshop</h1>
        <p class="text-sm text-white/90 mt-1">Sistema de gestión</p>
      </div>

      <!-- Card -->
      <div class="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-6 border border-white/70">
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

<style scoped>
.login-fondo {
  background:
    radial-gradient(circle at 20% 10%, rgba(164, 255, 124, 0.45), transparent 40%),
    radial-gradient(circle at 80% 90%, rgba(80, 220, 76, 0.38), transparent 45%),
    #62ef4f;
}

.molly-logo-wrap {
  background-color: #62ef4f;
  border-radius: 22px;
  overflow: hidden;
  width: clamp(170px, 44vw, 230px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.20);
  transform-origin: center;
  animation: molly-heartbeat 1.7s ease-in-out infinite;
}

.molly-logo-img {
  width: 100%;
  height: auto;
  display: block;
}

@keyframes molly-heartbeat {
  0%   { transform: scale(1); }
  16%  { transform: scale(1.06); }
  28%  { transform: scale(0.99); }
  42%  { transform: scale(1.08); }
  58%  { transform: scale(1); }
  100% { transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .molly-logo-wrap { animation: none; }
}

@media (display-mode: standalone) and (max-width: 768px) {
  .molly-logo {
    animation: molly-heartbeat 1.7s ease-in-out infinite;
  }
}

@media (max-width: 768px) {
  .login-fondo {
    padding-top: max(env(safe-area-inset-top), 16px);
    padding-bottom: max(env(safe-area-inset-bottom), 16px);
  }
}

@keyframes molly-heartbeat {
  0% {
    transform: scale(1);
  }
  16% {
    transform: scale(1.06);
  }
  28% {
    transform: scale(0.99);
  }
  42% {
    transform: scale(1.08);
  }
  58% {
    transform: scale(1);
  }
  100% {
    transform: scale(1);
  }
}
</style>
