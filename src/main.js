import { createApp }  from 'vue'
import { createPinia } from 'pinia'
import router          from '@/router'
import App             from './App.vue'
import './style.css'
import { registerSW }  from 'virtual:pwa-register'

import VueTippy from 'vue-tippy'
import 'tippy.js/dist/tippy.css' // estilo base
import 'tippy.js/themes/light-border.css' // theme que seteamos para que no sea negro oscuro
import 'tippy.js/animations/shift-away.css' // estilo para animación soft

const app = createApp(App)

app.use(createPinia())

app.use(VueTippy, {
  directive: 'tippy', // usaremos v-tippy
  defaultProps: {
    placement: 'top',
    animation: 'shift-away',
    theme: 'light-border',
    arrow: true,
  },
})

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

authStore.init()
  .then(() => {
    app.use(router)
    app.mount('#app')
    useSyncQueueStore().init()
  })
  .finally(() => {
    requestAnimationFrame(() => {
      ocultarSplashInicial()
    })
  })
