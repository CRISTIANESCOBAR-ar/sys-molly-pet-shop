<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import NavBar       from '@/components/NavBar.vue'
import VentaRapida  from '@/components/VentaRapida.vue'
import { useVentasStore }    from '@/stores/useVentasStore'
import { useProductosStore } from '@/stores/useProductosStore'
import { useAuthStore }      from '@/stores/useAuthStore'
import { METODOS_PAGO }      from '@/firebase/constants'

const ventasStore    = useVentasStore()
const productosStore = useProductosStore()
const authStore      = useAuthStore()

// ─── Tab mobile ────────────────────────────────────────────────────────
const tabActivo = ref('venta') // 'venta' | 'historial'

// ─── Filtro por período ────────────────────────────────────────────────────
const hoy     = new Date()
const periodo = ref({ year: hoy.getFullYear(), month: hoy.getMonth() + 1 })

const periodoLabel = computed(() => {
  const d = new Date(periodo.value.year, periodo.value.month - 1, 1)
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
})

const esMesActual = computed(() =>
  periodo.value.year === hoy.getFullYear() && periodo.value.month === hoy.getMonth() + 1,
)

function anteriorMes() {
  if (periodo.value.month === 1) {
    periodo.value = { year: periodo.value.year - 1, month: 12 }
  } else {
    periodo.value = { year: periodo.value.year, month: periodo.value.month - 1 }
  }
}

function siguienteMes() {
  if (esMesActual.value) return
  if (periodo.value.month === 12) {
    periodo.value = { year: periodo.value.year + 1, month: 1 }
  } else {
    periodo.value = { year: periodo.value.year, month: periodo.value.month + 1 }
  }
}

// ─── Resumen del período ───────────────────────────────────────────────────
const totalPeriodo = computed(() =>
  ventasStore.ventasActivas.reduce((s, v) => s + (v.total ?? 0), 0),
)

const porMetodo = computed(() => {
  const map = {}
  for (const v of ventasStore.ventasActivas) {
    const m = v.metodo_pago || 'efectivo'
    map[m] = (map[m] || 0) + (v.total ?? 0)
  }
  return map
})

// ─── Edición admin de ventas ───────────────────────────────────────────────
const modalEditarAbierto = ref(false)
const guardandoEdicion = ref(false)
const ventaEditandoId = ref('')
const ventaEditando = ref(null)
const formEdicion = ref({ metodo_pago: 'efectivo', total: 0, cantidad: 1 })

function abrirEditarVenta(venta) {
  ventaEditandoId.value = venta.id
  ventaEditando.value = venta
  const primerItem = venta.items?.[0]
  formEdicion.value = {
    metodo_pago: venta.metodo_pago || 'efectivo',
    total: Number(venta.total ?? 0),
    cantidad: Number(primerItem?.qty ?? 1),
  }
  modalEditarAbierto.value = true
}

function actualizarTotalDesdeCantidad() {
  const venta = ventaEditando.value
  if (!venta) return

  const precioUnitario = Number(venta.items?.[0]?.precio ?? 0)
  const cantidad = Number(formEdicion.value.cantidad ?? 0)
  if (precioUnitario <= 0 || cantidad <= 0) return

  const subtotal = precioUnitario * cantidad
  const metodo = METODOS_PAGO.find(m => m.value === formEdicion.value.metodo_pago)
  const recargo = metodo ? subtotal * (metodo.recargo ?? 0) : 0
  formEdicion.value.total = Math.round(subtotal + recargo)
}

function cerrarEditarVenta() {
  modalEditarAbierto.value = false
  guardandoEdicion.value = false
  ventaEditandoId.value = ''
  ventaEditando.value = null
}

function onKeydownModalVenta(e) {
  if (e.key !== 'Escape' || !modalEditarAbierto.value) return
  e.preventDefault()
  e.stopPropagation()
  cerrarEditarVenta()
}

async function guardarEdicionVenta() {
  if (!ventaEditandoId.value) return
  if (Number(formEdicion.value.total) < 0) return
  if (Number(formEdicion.value.cantidad) <= 0) return

  guardandoEdicion.value = true
  try {
    await ventasStore.actualizarVenta(ventaEditandoId.value, {
      metodo_pago: formEdicion.value.metodo_pago,
      total: Number(formEdicion.value.total),
      cantidad: Number(formEdicion.value.cantidad),
    })
    cerrarEditarVenta()
  } finally {
    guardandoEdicion.value = false
  }
}

async function eliminarVenta(venta) {
  const ok = window.confirm(`¿Anular venta por $${Number(venta.total ?? 0).toLocaleString('es-AR')}?`)
  if (!ok) return
  await ventasStore.eliminarVenta(venta.id)
}

// ─── Suscripción dinámica ──────────────────────────────────────────────────
let unsubProductos, unsubVentas
const loadingVentas = ref(false)

function resuscribir() {
  unsubVentas?.()
  loadingVentas.value = true
  const inicio = new Date(periodo.value.year, periodo.value.month - 1, 1)
  const fin    = new Date(periodo.value.year, periodo.value.month, 0, 23, 59, 59, 999)
  unsubVentas  = ventasStore.subscribeByPeriodo(inicio, fin, () => {
    loadingVentas.value = false
  })
}

onMounted(() => {
  unsubProductos = productosStore.subscribe()
  resuscribir()
  window.addEventListener('keydown', onKeydownModalVenta, true)
})

watch(periodo, resuscribir, { deep: true })

onUnmounted(() => {
  unsubProductos?.()
  unsubVentas?.()
  window.removeEventListener('keydown', onKeydownModalVenta, true)
})
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-50">
    <NavBar />

    <!-- Tab switcher mobile -->
    <div class="md:hidden flex border-b border-gray-100 bg-white">
      <button
        @click="tabActivo = 'venta'"
        :class="['flex-1 py-2.5 text-sm font-semibold transition-colors', tabActivo === 'venta' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-400']"
      >Nueva venta</button>
      <button
        @click="tabActivo = 'historial'"
        :class="['flex-1 py-2.5 text-sm font-semibold transition-colors', tabActivo === 'historial' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-400']"
      >Historial</button>
    </div>

    <!-- Mobile: pantalla completa de venta rápida -->
    <div class="flex-1 min-h-0 md:grid md:grid-cols-2 md:gap-0 flex flex-col">

      <!-- Panel izquierdo / único en mobile: VentaRápida -->
      <div
        :class="['flex-1 min-h-0 overflow-hidden flex-col bg-white md:border-r md:border-gray-100', tabActivo === 'venta' ? 'flex' : 'hidden md:flex']"
      >
        <div class="px-4 pt-4 pb-2">
          <h2 class="text-base font-bold text-gray-800">Nueva venta</h2>
        </div>
        <VentaRapida class="flex-1 overflow-hidden" />
      </div>

      <!-- Panel derecho: historial -->
      <div
        :class="['flex-col flex-1 min-h-0 relative', tabActivo === 'historial' ? 'flex' : 'hidden md:flex']"
      >
        <!-- Overlay de carga -->
        <Transition name="fade">
          <div
            v-if="loadingVentas"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm"
          >
            <svg class="animate-spin h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
            <p class="text-sm text-gray-500 font-medium">Cargando {{ periodoLabel }}…</p>
          </div>
        </Transition>

        <!-- CABECERA FIJA: navegación de mes + resumen -->
        <div class="flex-shrink-0 px-4 pt-4 md:px-6 md:pt-6 pb-3 bg-gray-50 border-b border-gray-100">
          <!-- Navegación de mes -->
          <div class="flex items-center justify-between mb-3">
            <button
              @click="anteriorMes"
              class="w-14 h-14 flex items-center justify-center rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-3xl font-bold transition-colors active:bg-gray-400"
              >
                <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2.75" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            <h2 class="text-lg font-bold text-gray-800 capitalize">{{ periodoLabel }}</h2>
            <button
              @click="siguienteMes"
              :disabled="esMesActual"
              class="w-14 h-14 flex items-center justify-center rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-3xl font-bold transition-colors active:bg-gray-400 disabled:opacity-30"
              >
                <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2.75" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
                </svg>
              </button>
          </div>
          <!-- Resumen del período -->
          <div v-if="ventasStore.ventasActivas.length > 0" class="bg-white rounded-xl px-4 py-3 space-y-1.5 shadow-sm">
            <div class="flex justify-between items-baseline">
              <span class="text-base text-gray-500">{{ ventasStore.ventasActivas.length }} ventas</span>
              <span class="text-2xl font-bold text-green-700">${{ totalPeriodo.toLocaleString('es-AR') }}</span>
            </div>
            <div
              v-for="(monto, metodo) in porMetodo"
              :key="metodo"
              class="flex justify-between text-base text-gray-500"
            >
              <span class="capitalize">{{ metodo }}</span>
              <span>${{ monto.toLocaleString('es-AR') }}</span>
            </div>
          </div>
          <p v-else class="text-base text-gray-400">Sin ventas en este período</p>
        </div>

        <!-- LISTA SCROLLEABLE -->
        <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-4 md:px-6">
        <div
          v-for="venta in ventasStore.ventasActivas"
          :key="venta.id"
          class="bg-white rounded-xl border border-gray-100 p-4 mb-3 shadow-sm"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-base text-gray-400">
              {{ venta.fecha?.toDate ? venta.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—' }}
              {{ venta.fecha?.toDate ? venta.fecha.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '' }}
            </span>
            <span class="text-base font-semibold bg-green-50 text-green-700 px-3 py-1 rounded-full capitalize">
              {{ venta.metodo_pago }}
            </span>
          </div>
          <ul class="text-base text-gray-600 mb-2 space-y-1">
            <li
              v-for="item in venta.items"
              :key="item.nombre"
              class="flex items-baseline justify-between gap-2"
            >
              <span class="truncate font-medium">{{ item.nombre }}</span>
              <span class="flex-shrink-0 text-gray-400">
                {{ item.venta_granel ? `${Number(item.qty).toFixed(3)} kg` : `×${item.qty} unid.` }}
              </span>
            </li>
          </ul>
          <p class="text-xl font-bold text-gray-900">
            ${{ (venta.total ?? 0).toLocaleString('es-AR') }}
          </p>
          <div v-if="authStore.isAdmin" class="flex justify-end gap-2 mt-3">
            <button
              @click="abrirEditarVenta(venta)"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 border border-gray-200 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 3.487a2.1 2.1 0 113 2.972L8.57 17.752 4 19l1.248-4.57L16.862 3.487z" />
              </svg>
              Editar
            </button>
            <button
              @click="eliminarVenta(venta)"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200 border border-red-200 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3a9 9 0 100 18 9 9 0 000-18z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75l10.5 10.5" />
              </svg>
              Anular
            </button>
          </div>
        </div>
        </div><!-- fin lista scrolleable -->
      </div>

    </div>

    <!-- Modal edición venta (solo admin) -->
    <Teleport to="body">
      <div
        v-if="modalEditarAbierto"
        class="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
        @click.self="cerrarEditarVenta"
        @keydown.esc.prevent.stop="cerrarEditarVenta"
      >
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-bold text-gray-800">Editar venta</h3>
            <button
              type="button"
              @click="cerrarEditarVenta"
              aria-label="Cerrar modal"
              class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              ✕
            </button>
          </div>

          <form @submit.prevent="guardarEdicionVenta" class="space-y-3">
            <div>
              <label class="text-xs text-gray-500">Método de pago</label>
              <select
                v-model="formEdicion.metodo_pago"
                @change="actualizarTotalDesdeCantidad"
                class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="credito">Crédito</option>
                <option value="debito">Débito</option>
              </select>
            </div>

            <div>
              <label class="text-xs text-gray-500">Cantidad</label>
              <input
                v-model.number="formEdicion.cantidad"
                type="number"
                min="0.001"
                step="0.001"
                @input="actualizarTotalDesdeCantidad"
                class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            <div>
              <label class="text-xs text-gray-500">Total</label>
              <input
                v-model.number="formEdicion.total"
                type="number"
                min="0"
                class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            <div class="flex gap-3 pt-1">
              <button
                type="button"
                @click="cerrarEditarVenta"
                class="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                ↩️ Cancelar
              </button>
              <button
                type="submit"
                :disabled="guardandoEdicion"
                class="flex-1 py-2.5 bg-green-500 text-white font-semibold rounded-xl text-sm disabled:opacity-50 hover:bg-green-600 transition-colors"
              >
                {{ guardandoEdicion ? '⏳ Guardando...' : '💾 Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
