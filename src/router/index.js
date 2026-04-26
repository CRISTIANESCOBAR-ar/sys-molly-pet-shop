import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'
import LoginView from '@/views/LoginView.vue'
import VentasView from '@/views/VentasView.vue'
import StockView from '@/views/StockView.vue'
import ProveedoresView from '@/views/ProveedoresView.vue'
import CuentasPagarView from '@/views/CuentasPagarView.vue'
import ComprasView from '@/views/ComprasView.vue'
import GraficosView from '@/views/GraficosView.vue'
import MetricasLecturaView from '@/views/MetricasLecturaView.vue'
import UsuariosView from '@/views/UsuariosView.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: { public: true },
  },
  {
    path: '/',
    redirect: '/ventas',
  },
  {
    path: '/ventas',
    name: 'Ventas',
    component: VentasView,
    meta: { requiresAuth: true },
  },
  {
    path: '/stock',
    name: 'Stock',
    component: StockView,
    meta: { requiresAuth: true },
  },
  {
    path: '/proveedores',
    name: 'Proveedores',
    component: ProveedoresView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/cuentas-pagar',
    name: 'CuentasPagar',
    component: CuentasPagarView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/compras',
    name: 'Compras',
    component: ComprasView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/graficos',
    name: 'Graficos',
    component: GraficosView,
    meta: { requiresAuth: true },
  },
  {
    path: '/usuarios',
    name: 'Usuarios',
    component: UsuariosView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/metricas',
    name: 'Metricas',
    component: MetricasLecturaView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    // Catch-all: redirige a ventas
    path: '/:pathMatch(.*)*',
    redirect: '/ventas',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ─── Middleware de rutas ──────────────────────────────────────────────────────
router.beforeEach((to) => {
  const authStore = useAuthStore()

  // Rutas públicas sin restricción
  if (to.meta.public) return true

  // Sin sesión → Login
  if (!authStore.isAuthenticated) return { name: 'Login' }

  // Ruta de solo admin → redirigir cajeros
  if (to.meta.requiresAdmin && !authStore.isAdmin) return { name: 'Ventas' }

  return true
})

// Si una lazy-view falla de cargar (SW stale), recarga la página una vez
let _cacheErrorReloaded = false
router.onError((err) => {
  if (/dynamically imported module|Failed to fetch|Loading chunk|ChunkLoadError/i.test(err?.message || '')) {
    if (!_cacheErrorReloaded) {
      _cacheErrorReloaded = true
      window.location.reload()
    }
  }
})

export default router
