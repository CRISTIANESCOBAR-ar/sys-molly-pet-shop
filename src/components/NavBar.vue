<script setup>
import { ref, computed } from 'vue'
import { useAuthStore }     from '@/stores/useAuthStore'
import { useProductosStore } from '@/stores/useProductosStore'
import { useSyncQueueStore } from '@/stores/useSyncQueueStore'
import { useUsageMetricsStore } from '@/stores/useUsageMetricsStore'
import { useRouter, useRoute } from 'vue-router'

const authStore      = useAuthStore()
const productosStore = useProductosStore()
const syncQueueStore = useSyncQueueStore()
const usageMetricsStore = useUsageMetricsStore()
const router         = useRouter()
const route          = useRoute()

const menuAbierto = ref(false)

const todosItems = [
  { path: '/ventas',        label: 'Ventas',      icon: '🛒', admin: false, importante: true },
  { path: '/stock',         label: 'Stock',       icon: '📦', admin: false, importante: true },
  { path: '/compras',       label: 'Compras',     icon: '🛍️', admin: true,  importante: true },
  { path: '/cuentas-pagar', label: 'Cuentas',     icon: '💰', admin: true,  importante: true },
  { path: '/graficos',      label: 'Graficos',    icon: '📈', admin: false, importante: false },
  { path: '/proveedores',   label: 'Proveedores', icon: '🏭', admin: true,  importante: false },
  { path: '/usuarios',      label: 'Usuarios',    icon: '👥', admin: true,  importante: false },
  { path: '/metricas',      label: 'Metricas',    icon: '📊', admin: true,  importante: false },
]

const itemsVisibles = computed(() =>
  todosItems.filter(i => !i.admin || authStore.isAdmin),
)

const seccionActual = computed(() =>
  todosItems.find(i => i.path === route.path)?.label ?? 'Molly Petshop',
)

const resumenCostoSesion = computed(() => ({
  lecturas: usageMetricsStore.estimatedReads,
  escrituras: usageMetricsStore.estimatedWrites,
}))

const nivelCostoSesion = computed(() => {
  const total = (Number(resumenCostoSesion.value.lecturas) || 0) + (Number(resumenCostoSesion.value.escrituras) || 0)
  if (total >= 1000) return { label: 'Alto', desktopClass: 'bg-red-50 text-red-700 border-red-200' }
  if (total >= 300) return { label: 'Medio', desktopClass: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { label: 'Bajo', desktopClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
})

function navegar(path) {
  router.push(path)
  menuAbierto.value = false
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
  menuAbierto.value = false
}
</script>

<template>
  <nav class="border-b border-green-400 shadow-md flex-shrink-0" style="background: #62ef4f">
    <div class="max-w-7xl mx-auto px-4 flex items-center justify-between py-3">

      <!-- Logo + nombre -->
      <div class="flex items-center gap-2 min-w-0 flex-shrink-0">
        <img src="/icons/icon-192.png" alt="Molly Petshop" class="w-8 h-8 rounded-xl object-contain shadow-sm flex-shrink-0" />
        <div class="flex flex-col min-w-0 leading-tight">
          <span class="font-extrabold text-green-950 text-sm truncate">Molly Petshop</span>
          <span class="text-[10px] text-green-800 truncate md:hidden">{{ seccionActual }}</span>
        </div>
      </div>

      <!-- Desktop: links compactos -->
      <div class="hidden md:flex items-center space-x-1 lg:space-x-1.5 overflow-hidden">
        <router-link
          v-for="item in itemsVisibles"
          :key="item.path"
          :to="item.path"
          v-tippy="!item.importante ? item.label : undefined"
          :class="[
            'flex items-center justify-center rounded-xl text-[13px] font-medium transition-all duration-200 border whitespace-nowrap gap-1.5',
            route.path === item.path
              ? 'bg-white/60 text-green-950 font-bold border-white/40 shadow-sm'
              : 'text-green-950 border-transparent hover:bg-white/30 hover:border-white/20',
            item.importante ? 'px-3 py-1.5' : 'w-8 h-8'
          ]"
        >
          <span v-if="!item.importante" class="text-base leading-none">{{ item.icon }}</span>
          <template v-else>
            <span class="text-base leading-none">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </template>
        </router-link>
      </div>

      <!-- Desktop: badges + usuario + salir -->
      <div class="hidden md:flex items-center gap-1.5 flex-shrink-0">
        <!-- Badge stock bajo -->
        <router-link
          v-if="productosStore.productosConStockBajo.length > 0"
          to="/stock"
          class="flex items-center gap-1 bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded-lg"
        >⚠ {{ productosStore.productosConStockBajo.length }} sin stock</router-link>

        <!-- Badge cola offline -->
        <button
          v-if="syncQueueStore.isSyncing || syncQueueStore.pendingCount > 0"
          @click="syncQueueStore.processQueue()"
          :title="syncQueueStore.isSyncing ? 'Sincronizando...' : `${syncQueueStore.pendingCount} operación(es) pendiente(s). Click para reintentar.`"
          :class="[
            'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border transition-colors',
            syncQueueStore.isSyncing
              ? 'bg-blue-600 text-white border-blue-700'
              : 'bg-amber-500 text-white border-amber-600',
          ]"
        >
          <span v-if="syncQueueStore.isSyncing">↻ Sync</span>
          <span v-else>⏳ {{ syncQueueStore.pendingCount }}</span>
        </button>

        <!-- Badge métricas -->
        <router-link
          v-if="authStore.isAdmin"
          to="/metricas"
          class="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border bg-green-900/15 text-green-950 border-green-800/30"
          :title="`Métricas estimadas · R${resumenCostoSesion.lecturas} / W${resumenCostoSesion.escrituras}`"
        >
          📊 {{ nivelCostoSesion.label }}
        </router-link>

        <!-- Separador -->
        <div class="w-px h-5 bg-green-800/30 mx-0.5 md:mr-1"></div>

        <!-- Usuario -->
        <span class="text-[13px] font-semibold text-green-950 truncate max-w-[120px]">
          {{ authStore.perfil?.nombre?.split(' ')[0] || authStore.user?.email?.split('@')[0] }}
        </span>

        <!-- Salir -->
        <button
          @click="handleLogout"
          class="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-bold bg-white/20 hover:bg-white/40 text-green-950 border border-green-800/20 hover:border-green-800/40 shadow-sm transition-all focus:ring-2 focus:ring-green-900/20"
        >
          <svg class="w-4 h-4 opacity-80" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Salir
        </button>
      </div>

      <!-- Mobile: badges + hamburguesa -->
      <div class="flex md:hidden items-center gap-1.5">
        <router-link
          v-if="productosStore.productosConStockBajo.length > 0"
          to="/stock"
          @click="menuAbierto = false"
          class="flex items-center gap-1 bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded-lg"
        >⚠ {{ productosStore.productosConStockBajo.length }}</router-link>

        <button
          v-if="syncQueueStore.isSyncing || syncQueueStore.pendingCount > 0"
          @click="syncQueueStore.processQueue()"
          :class="[
            'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg',
            syncQueueStore.isSyncing ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white',
          ]"
        >
          <span v-if="syncQueueStore.isSyncing">↻</span>
          <span v-else>⏳ {{ syncQueueStore.pendingCount }}</span>
        </button>

        <router-link
          v-if="authStore.isAdmin"
          to="/metricas"
          @click="menuAbierto = false"
          class="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border bg-green-900/15 text-green-950 border-green-800/30"
        >📊</router-link>

        <button
          @click="menuAbierto = !menuAbierto"
          class="flex items-center justify-center w-9 h-9 rounded-xl bg-green-900/20 hover:bg-green-900/35 text-green-950 text-lg font-bold transition-colors border border-green-900/30"
          aria-label="Menú"
        >
          {{ menuAbierto ? '✕' : '☰' }}
        </button>
      </div>
    </div>

    <!-- Drawer mobile: overlay fijo, no desplaza el contenido -->
    <Teleport to="body">
      <Transition name="drawer">
        <div
          v-if="menuAbierto"
          class="fixed inset-0 z-50 md:hidden"
          @click="menuAbierto = false"
        >
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/20"></div>

          <!-- Panel -->
          <div
            class="absolute top-12 inset-x-0 bg-white shadow-lg border-t border-gray-100 pb-4"
            @click.stop
          >
            <!-- Nav items -->
            <div class="px-3 pt-3 space-y-1">
              <button
                v-for="item in itemsVisibles"
                :key="item.path"
                @click="navegar(item.path)"
                :class="[
                  'w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-lg font-medium transition-colors text-left',
                  route.path === item.path
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-50',
                ]"
              >
                <span class="text-2xl">{{ item.icon }}</span>
                {{ item.label }}
              </button>
            </div>

            <!-- Divider + usuario + salir -->
            <div class="mt-3 px-3 pt-3 border-t border-gray-100">
              <p class="text-sm text-gray-400 px-4 mb-2 truncate">
                {{ authStore.user?.email }}
                <span class="ml-1 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                  {{ authStore.isAdmin ? 'Admin' : 'Cajero' }}
                </span>
              </p>
              <button
                @click="handleLogout"
                class="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-lg font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <span class="text-2xl">🚪</span> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </nav>
</template>

<style scoped>
.drawer-enter-active, .drawer-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
