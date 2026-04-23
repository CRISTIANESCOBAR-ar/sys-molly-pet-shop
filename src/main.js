import { createApp }  from 'vue'
import { createPinia } from 'pinia'
import router          from '@/router'
import App             from './App.vue'
import './style.css'
import { registerSW }  from 'virtual:pwa-register'

const app = createApp(App)

app.use(createPinia())

// El router necesita el authStore ya inicializado antes de sus guards,
// por eso lo importamos y llamamos init() antes de montar.
import { useAuthStore }      from '@/stores/useAuthStore'
import { useSyncQueueStore } from '@/stores/useSyncQueueStore'
const authStore      = useAuthStore()

function ocultarSplashInicial() {
  const splash = document.getElementById('boot-splash')
  if (!splash) return

  splash.classList.add('is-hidden')
  window.setTimeout(() => {
    splash.remove()
  }, 260)
}

// Fuerza la adopción de nuevas versiones de la app sin reinstalar la PWA.
// Cuando el SW nuevo toma control, recarga la página para usar el JS actualizado.
let recargandoPorSW = false
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargandoPorSW) return
    recargandoPorSW = true
    window.location.reload()
  })
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true)
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    // Polling cada 30s en lugar de 60s para detectar actualizaciones más rápido
    setInterval(() => {
      registration.update()
    }, 30 * 1000)
  },
})

authStore.init().then(() => {
  app.use(router)
  app.mount('#app')
  requestAnimationFrame(() => {
    ocultarSplashInicial()
  })
  useSyncQueueStore().init()
})
