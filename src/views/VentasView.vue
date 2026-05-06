<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import NavBar       from '@/components/NavBar.vue'
import VentaRapida  from '@/components/VentaRapida.vue'
import { useVentasStore }    from '@/stores/useVentasStore'
import { useProductosStore } from '@/stores/useProductosStore'
import { useAuthStore }      from '@/stores/useAuthStore'
import { useUsuariosStore }  from '@/stores/useUsuariosStore'
import { METODOS_PAGO }      from '@/firebase/constants'

const ventasStore    = useVentasStore()
const productosStore = useProductosStore()
const authStore      = useAuthStore()
const usuariosStore  = useUsuariosStore()

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
const formEdicion = ref({ nombre: '', precio: 0, metodo_pago: 'efectivo', cantidad: 1, total: 0 })

function abrirEditarVenta(venta) {
  ventaEditandoId.value = venta.id
  ventaEditando.value = venta
  const primerItem = venta.items?.[0]
  formEdicion.value = {
    nombre:      String(primerItem?.nombre ?? '').trim(),
    precio:      Number(primerItem?.precio ?? 0),
    metodo_pago: venta.metodo_pago || 'efectivo',
    cantidad:    Number(primerItem?.qty ?? 1),
    total:       Number(venta.total ?? 0),
  }
  modalEditarAbierto.value = true
}

function actualizarTotalDesdeCantidad() {
  const precioUnitario = Number(formEdicion.value.precio ?? 0)
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
      nombre:      String(formEdicion.value.nombre || '').trim().toUpperCase(),
      precio:      Number(formEdicion.value.precio),
      metodo_pago: formEdicion.value.metodo_pago,
      cantidad:    Number(formEdicion.value.cantidad),
      total:       Number(formEdicion.value.total),
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
let unsubProductos
let unsubUsuarios
const loadingVentas = ref(false)

async function cargarPeriodo(options = {}) {
  loadingVentas.value = true
  const inicio = new Date(periodo.value.year, periodo.value.month - 1, 1)
  const fin    = new Date(periodo.value.year, periodo.value.month, 0, 23, 59, 59, 999)
  try {
    await ventasStore.initPeriodo(inicio, fin, options)
  } finally {
    loadingVentas.value = false
  }
}

function obtenerNombreUsuario(email) {
  const usuario = usuariosStore.usuarios.find(u => u.email === email)
  return usuario ? usuario.nombre : 'Vendedor'
}

onMounted(() => {
  unsubProductos = productosStore.subscribe()
  unsubUsuarios = usuariosStore.subscribe()
  cargarPeriodo({ force: true })
  window.addEventListener('keydown', onKeydownModalVenta, true)
})

watch(periodo, () => {
  cargarPeriodo({ force: true })
}, { deep: true })

onUnmounted(() => {
  unsubProductos?.()
  unsubUsuarios?.()
  window.removeEventListener('keydown', onKeydownModalVenta, true)
})

async function cargarMasVentas() {
  ventasStore.loadMorePeriodo()
}
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
          v-for="venta in ventasStore.ventasMostradas"
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
              <span class="flex-shrink-0 text-gray-400 text-right">
                <span>{{ item.venta_granel ? `${Number(item.qty).toFixed(3)} kg` : `×${item.qty} unid.` }}</span>
                <span class="ml-2 text-gray-500">${{ Math.round((item.precio ?? 0) * (item.qty ?? 0)).toLocaleString('es-AR') }}</span>
              </span>
            </li>
          </ul>
          <p class="text-xl font-bold text-gray-900">
            ${{ (venta.total ?? 0).toLocaleString('es-AR') }}
          </p>
          <p v-if="venta.usuario_email" class="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>
            {{ obtenerNombreUsuario(venta.usuario_email) }} ({{ venta.usuario_email }})
          </p>
          <div v-if="authStore.isAdmin" class="flex justify-end gap-2 mt-3">
            <button
              @click="abrirEditarVenta(venta)"
              v-tippy="'Corregir datos de la venta'"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 border border-gray-200 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 3.487a2.1 2.1 0 113 2.972L8.57 17.752 4 19l1.248-4.57L16.862 3.487z" />
              </svg>
              Editar
            </button>
            <button
              @click="eliminarVenta(venta)"
              v-tippy="'Anular y borrar esta venta'"
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

        <div class="py-2">
          <button
            v-if="ventasStore.hasMorePeriodo"
            @click="cargarMasVentas"
            class="w-full py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Cargar más ventas ({{ ventasStore.ventasActivas.length - ventasStore.ventasMostradas.length }} restantes)
          </button>
        </div>
        </div><!-- fin lista scrolleable -->
      </div>

    </div>

    <!-- Modal edición venta (solo admin) -->
    <Teleport to="body">
      <div
        v-if="modalEditarAbierto"
        class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
        @click.self="cerrarEditarVenta"
        @keydown.esc.prevent.stop="cerrarEditarVenta"
      >
        <div class="bg-white w-full max-w-md rounded-xl shadow-xl flex flex-col" style="max-height: min(90vh, 620px)">

          <!-- Header fijo -->
          <div class="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
            <h3 class="text-base font-bold text-gray-800">Editar venta</h3>
            <button
              type="button"
              @click="cerrarEditarVenta"
              aria-label="Cerrar modal"
              class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >✕</button>
          </div>

          <!-- Contenido scrolleable -->
          <form @submit.prevent="guardarEdicionVenta" class="overflow-y-auto flex-1 px-5 py-4 space-y-3">

            <!-- Producto -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Producto</label>
              <input
                v-model="formEdicion.nombre"
                type="text"
                placeholder="Nombre del producto"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            <!-- Cantidad + Precio unitario -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Cantidad</label>
                <input
                  v-model.number="formEdicion.cantidad"
                  type="number" min="0.001" step="0.001"
                  @input="actualizarTotalDesdeCantidad"
                  class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Precio unitario $</label>
                <input
                  v-model.number="formEdicion.precio"
                  type="number" min="0"
                  @input="actualizarTotalDesdeCantidad"
                  class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
            </div>

            <!-- Método de pago (chips) -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Método de pago</label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="m in METODOS_PAGO"
                  :key="m.value"
                  type="button"
                  @click="formEdicion.metodo_pago = m.value; actualizarTotalDesdeCantidad()"
                  :class="[
                    'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors',
                    formEdicion.metodo_pago === m.value
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-green-300',
                  ]"
                >{{ m.label }}</button>
              </div>
            </div>

            <!-- Total -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Total $</label>
              <input
                v-model.number="formEdicion.total"
                type="number" min="0"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

          </form>

          <!-- Botones fijos abajo -->
          <div class="flex gap-2 px-5 py-3 border-t border-gray-100 flex-shrink-0">
            <button
              type="button"
              @click="cerrarEditarVenta"
              class="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >↩️ Cancelar</button>
            <button
              type="button"
              @click="guardarEdicionVenta"
              :disabled="guardandoEdicion"
              class="flex-1 py-2.5 bg-green-500 text-white font-bold rounded-lg text-sm disabled:opacity-50 hover:bg-green-600 transition-colors"
            >{{ guardandoEdicion ? '⏳ Guardando...' : '💾 Guardar' }}</button>
          </div>

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
