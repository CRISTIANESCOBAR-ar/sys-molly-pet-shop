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
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true)
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    setInterval(() => {
      registration.update()
    }, 60 * 1000)
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
