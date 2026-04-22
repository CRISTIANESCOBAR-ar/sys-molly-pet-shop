import { createApp }  from 'vue'
import { createPinia } from 'pinia'
import router          from '@/router'
import App             from './App.vue'
import './style.css'

const app = createApp(App)

app.use(createPinia())

// El router necesita el authStore ya inicializado antes de sus guards,
// por eso lo importamos y llamamos init() antes de montar.
import { useAuthStore } from '@/stores/useAuthStore'
const authStore = useAuthStore()

authStore.init().then(() => {
  app.use(router)
  app.mount('#app')
})
