<script setup>
import { ref, computed } from 'vue'
import { useVentasStore } from '@/stores/useVentasStore'
import { useAuthStore }   from '@/stores/useAuthStore'
import { useSyncQueueStore, esErrorRecuperable } from '@/stores/useSyncQueueStore'
import { METODOS_PAGO }   from '@/firebase/constants'

const ventasStore    = useVentasStore()
const authStore      = useAuthStore()
const syncQueueStore = useSyncQueueStore()

const drawerAbierto = ref(false)
const confirmando   = ref(false)
const exito         = ref(false)
const errorMsg      = ref('')
const enCola        = ref(false)

const carritoVacio   = computed(() => ventasStore.carrito.length === 0)
const puedeConfirmar = computed(() => !carritoVacio.value && !confirmando.value)

function abrirDrawer()  { drawerAbierto.value = true }
function cerrarDrawer() { drawerAbierto.value = false }

function mensajeErrorAmigable(e) {
  const msg  = (e?.message || '').toLowerCase()
  const code = (e?.code    || '').toLowerCase()
  if (msg.includes('quota') || msg.includes('resource') || code.includes('resource-exhausted')) {
    return 'Límite diario de operaciones alcanzado. Intentá en unos minutos o contactá al administrador.'
  }
  if (msg.includes('stock insuficiente')) return e.message
  if (msg.includes('carrito')) return 'El carrito está vacío'
  if (msg.includes('offline') || code.includes('unavailable')) {
    return 'Sin conexión. Verificá internet e intentá de nuevo.'
  }
  return 'Error al registrar la venta. Intentá de nuevo.'
}

async function confirmarVenta() {
  if (!puedeConfirmar.value) return
  confirmando.value = true
  errorMsg.value    = ''
  enCola.value      = false
  try {
    await ventasStore.registrarVenta()
    drawerAbierto.value = false
    exito.value = true
    setTimeout(() => { exito.value = false }, 2500)
  } catch (e) {
    if (esErrorRecuperable(e)) {
      syncQueueStore.addVenta({
        items:          ventasStore.carrito.map(i => ({ ...i })),
        metodo_pago:    ventasStore.metodoPago,
        subtotal:       ventasStore.subtotal,
        recargo_metodo: ventasStore.recargoMetodo,
        total:          ventasStore.total,
        id_usuario:     authStore.user?.uid || null,
      })
      ventasStore.limpiarCarrito()
      drawerAbierto.value = false
      enCola.value = true
      setTimeout(() => { enCola.value = false }, 6000)
    } else {
      errorMsg.value = mensajeErrorAmigable(e)
    }
  } finally {
    confirmando.value = false
  }
}
</script>

<template>
  <Teleport to="body">

    <!-- ── Flash éxito ─────────────────────────────────────────────────────── -->
    <Transition name="fade">
      <div
        v-if="exito"
        class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[65] text-sm font-semibold text-green-600 bg-green-50 border border-green-200 rounded-2xl py-3 px-6 shadow-lg pointer-events-none"
      >
        ✓ Venta registrada
      </div>
    </Transition>

    <!-- ── Flash cola offline ─────────────────────────────────────────────── -->
    <Transition name="fade">
      <div
        v-if="enCola"
        class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[65] text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl py-3 px-6 shadow-lg pointer-events-none"
      >
        ⏳ Sin acceso — venta guardada para sincronizar
      </div>
    </Transition>

    <!-- ── Botón flotante ─────────────────────────────────────────────────── -->
    <Transition name="bounce">
      <button
        v-if="!drawerAbierto"
        @click="abrirDrawer"
        :class="[
          'fixed bottom-6 right-5 z-[60] flex items-center gap-2 font-bold rounded-2xl shadow-xl px-5 py-3.5 transition-colors',
          carritoVacio ? 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50' : 'bg-green-500 text-white active:bg-green-600'
        ]"
        aria-label="Ver carrito"
      >
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
        </svg>
        <span>Ver carrito</span>
        <span :class="['text-xs font-black rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1 leading-none', carritoVacio ? 'bg-gray-100 text-gray-600' : 'bg-white text-green-600']">
          {{ ventasStore.carrito.length }}
        </span>
      </button>
    </Transition>

    <!-- ── Overlay ────────────────────────────────────────────────────────── -->
    <Transition name="overlay">
      <div
        v-if="drawerAbierto"
        class="fixed inset-0 z-[60] bg-black/40"
        @click.self="cerrarDrawer"
      />
    </Transition>

    <!-- ── Panel del carrito ──────────────────────────────────────────────── -->
    <Transition name="drawer">
      <div
        v-if="drawerAbierto"
        class="fixed bottom-0 left-0 right-0 z-[61] bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] md:left-auto md:top-0 md:bottom-0 md:right-0 md:max-h-none md:w-96 md:rounded-none md:rounded-l-2xl"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <h3 class="text-base font-bold text-gray-800">
            Carrito
            <span class="ml-1.5 text-sm font-normal text-gray-400">
              ({{ ventasStore.carrito.length }} {{ ventasStore.carrito.length === 1 ? 'producto' : 'productos' }})
            </span>
          </h3>
          <button
            @click="cerrarDrawer"
            class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors"
            aria-label="Cerrar carrito"
          >✕</button>
        </div>

        <!-- Lista de ítems (scrolleable) -->
        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-2">
          <div v-if="ventasStore.carrito.length === 0" class="py-12 text-center text-sm text-gray-400">
            Carrito vacío — tocá un producto para agregarlo
          </div>
          <div v-else>
            <div
              v-for="item in ventasStore.carrito"
              :key="item.id"
              class="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5"
            >
              <button
                @click="ventasStore.quitarDelCarrito(item.id)"
                class="w-7 h-7 rounded-lg bg-red-50 text-red-500 text-base font-bold flex items-center justify-center flex-shrink-0 active:bg-red-100 transition-colors"
                aria-label="Quitar ítem"
              >−</button>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-800 truncate">{{ item.nombre }}</p>
                <p class="text-xs text-gray-400">
                  {{ item.venta_granel
                    ? `${parseFloat(item.qty.toFixed(5))} kg`
                    : item.es_fraccionado
                      ? `${parseFloat(Number(item.qty).toFixed(5))} unid.`
                      : `× ${item.qty} unid.` }}
                </p>
              </div>
              <span class="text-sm font-bold text-gray-800 flex-shrink-0">
                ${{ Math.round((item.precio ?? 0) * item.qty).toLocaleString('es-AR') }}
              </span>
            </div>
          </div>
        </div>

        <!-- Pie del drawer (siempre visible) -->
        <div class="flex-shrink-0 border-t border-gray-100 px-5 pt-4 pb-6 space-y-4 bg-white">

          <!-- Método de pago -->
          <div>
            <p class="text-xs font-medium text-gray-500 mb-2">Método de pago</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="m in METODOS_PAGO"
                :key="m.value"
                @click="ventasStore.metodoPago = m.value"
                :class="[
                  'py-2.5 rounded-xl text-xs font-semibold border transition-colors',
                  ventasStore.metodoPago === m.value
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-white text-gray-600 border-gray-200 active:bg-gray-50',
                ]"
              >{{ m.label }}</button>
            </div>
          </div>

          <!-- Totales -->
          <div class="space-y-1.5 border-t border-gray-100 pt-3">
            <div class="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>${{ ventasStore.subtotal.toLocaleString('es-AR') }}</span>
            </div>
            <div v-if="ventasStore.recargoMetodo > 0" class="flex justify-between text-sm text-orange-500 font-medium">
              <span>Recargo crédito 10%</span>
              <span>+${{ ventasStore.recargoMetodo.toLocaleString('es-AR') }}</span>
            </div>
            <div class="flex justify-between text-xl font-black text-gray-900 pt-1">
              <span>Total a pagar</span>
              <span>${{ ventasStore.total.toLocaleString('es-AR') }}</span>
            </div>
          </div>

          <!-- Error -->
          <p v-if="errorMsg" class="text-xs text-red-500 text-center">{{ errorMsg }}</p>

          <!-- Botón confirmar -->
          <button
            @click="confirmarVenta"
            :disabled="!puedeConfirmar"
            class="w-full py-4 bg-green-500 text-white font-bold rounded-2xl text-base disabled:opacity-50 active:bg-green-600 transition-colors shadow-sm"
          >
            {{ confirmando ? 'Registrando...' : `Finalizar venta · $${ventasStore.total.toLocaleString('es-AR')}` }}
          </button>

        </div>
      </div>
    </Transition>

  </Teleport>
</template>

<style scoped>
/* Fade genérico */
.fade-enter-active,
.fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }

/* Overlay */
.overlay-enter-active,
.overlay-leave-active { transition: opacity 0.25s ease; }
.overlay-enter-from,
.overlay-leave-to     { opacity: 0; }

/* Drawer — sube desde abajo en mobile, entra desde la derecha en desktop */
.drawer-enter-active,
.drawer-leave-active { transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
.drawer-enter-from,
.drawer-leave-to     { transform: translateY(100%); }

@media (min-width: 768px) {
  .drawer-enter-from,
  .drawer-leave-to { transform: translateX(100%); }
}

/* Botón flotante */
.bounce-enter-active { animation: pop-in 0.25s ease; }
.bounce-leave-active { animation: pop-in 0.15s ease reverse; }
@keyframes pop-in {
  from { transform: scale(0.7); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
</style>
