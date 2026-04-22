import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    redirect: '/ventas',
  },
  {
    path: '/ventas',
    name: 'Ventas',
    component: () => import('@/views/VentasView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/stock',
    name: 'Stock',
    component: () => import('@/views/StockView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/proveedores',
    name: 'Proveedores',
    component: () => import('@/views/ProveedoresView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/cuentas-pagar',
    name: 'CuentasPagar',
    component: () => import('@/views/CuentasPagarView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/compras',
    name: 'Compras',
    component: () => import('@/views/ComprasView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/graficos',
    name: 'Graficos',
    component: () => import('@/views/GraficosView.vue'),
    meta: { requiresAuth: true },
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

export default router
