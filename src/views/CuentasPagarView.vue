<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useProveedoresStore } from '@/stores/useProveedoresStore'
import Swal from 'sweetalert2'

const proveedoresStore = useProveedoresStore()

let unsubProv, unsubCuentas

onMounted(() => {
  unsubProv    = proveedoresStore.subscribeProveedores()
  unsubCuentas = proveedoresStore.subscribeCuentasPagar()
})
onUnmounted(() => {
  unsubProv?.()
  unsubCuentas?.()
})

// ─── Filtros ────────────────────────────────────────────────────────────────
const filtroEstado = ref('pendiente')

const cuentasFiltradas = computed(() =>
  filtroEstado.value === 'todas'
    ? proveedoresStore.cuentasPagar
    : proveedoresStore.cuentasPagar.filter(c => c.estado === filtroEstado.value),
)

function nombreProveedor(id) {
  return proveedoresStore.proveedores.find(p => p.id === id)?.nombre || id
}

function estaVencida(cuenta) {
  if (!cuenta.fecha_vencimiento || cuenta.estado === 'pagado') return false
  return new Date(cuenta.fecha_vencimiento) < new Date()
}

// ─── Modal nueva cuenta ─────────────────────────────────────────────────────
const modalAbierto = ref(false)
const form = ref({ id_proveedor: '', nro_factura: '', monto_total: 0, fecha_vencimiento: '' })
const errorMsg = ref('')

const formularioValido = computed(() =>
  form.value.id_proveedor &&
  form.value.nro_factura.trim() &&
  form.value.monto_total > 0 &&
  form.value.fecha_vencimiento,
)

async function guardarCuenta() {
  if (!formularioValido.value) return
  errorMsg.value = ''
  try {
    await proveedoresStore.crearCuentaPagar(form.value)
    modalAbierto.value = false
    form.value = { id_proveedor: '', nro_factura: '', monto_total: 0, fecha_vencimiento: '' }
  } catch (e) {
    errorMsg.value = e.message
  }
}

async function marcarPagada(cuenta) {
  const result = await Swal.fire({
    title: '¿Confirmar pago?',
    text: `¿Marcar como pagada la factura ${cuenta.nro_factura}?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#9ca3af',
    confirmButtonText: 'Sí, pagar',
    cancelButtonText: 'Cancelar'
  })
  if (!result.isConfirmed) return
  await proveedoresStore.pagarCuenta(cuenta.id, cuenta.id_proveedor, cuenta.monto_total)
}
</script>

<template>
  <div class="flex flex-col min-h-screen bg-gray-50">
    <NavBar />

    <main class="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 class="text-xl font-bold text-gray-800">Cuentas a pagar</h1>
          <p class="text-sm text-gray-400">
            Saldo total: <span class="font-bold text-red-600">
              ${{ proveedoresStore.proveedores.reduce((s, p) => s + (p.saldo_pendiente || 0), 0).toLocaleString('es-AR') }}
            </span>
          </p>
        </div>
        <button
          @click="modalAbierto = true"
          class="bg-green-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-green-600 transition-colors"
        >
          + Nueva factura
        </button>
      </div>

      <!-- Filtros de estado -->
      <div class="flex gap-2 mb-4">
        <button
          v-for="estado in ['pendiente', 'pagado', 'todas']"
          :key="estado"
          @click="filtroEstado = estado"
          :class="[
            'px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize',
            filtroEstado === estado
              ? 'bg-green-500 text-white'
              : 'bg-white text-gray-500 border border-gray-200',
          ]"
        >
          {{ estado }}
        </button>
      </div>

      <!-- Tabla -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
            <tr>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Factura</th>
              <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Monto</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vencimiento</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr
              v-for="cuenta in cuentasFiltradas"
              :key="cuenta.id"
              :class="{ 'bg-red-50/40': estaVencida(cuenta) }"
              class="hover:bg-gray-50 transition-colors"
            >
              <td class="px-4 py-3 font-medium text-gray-800">{{ nombreProveedor(cuenta.id_proveedor) }}</td>
              <td class="px-4 py-3 text-gray-500">{{ cuenta.nro_factura }}</td>
              <td class="px-4 py-3 text-right font-bold text-gray-800">
                ${{ (cuenta.monto_total ?? 0).toLocaleString('es-AR') }}
              </td>
              <td class="px-4 py-3 text-center text-gray-500">
                {{ cuenta.fecha_vencimiento }}
                <span v-if="estaVencida(cuenta)" class="ml-1 text-red-500 text-xs font-semibold">VENCIDA</span>
              </td>
              <td class="px-4 py-3 text-center">
                <span :class="[
                  'text-xs font-semibold px-2 py-1 rounded-full',
                  cuenta.estado === 'pagado'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700',
                ]">
                  {{ cuenta.estado }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  v-if="cuenta.estado === 'pendiente'"
                  @click="marcarPagada(cuenta)"
                  :disabled="proveedoresStore.loading"
                  class="text-xs text-green-600 hover:text-green-800 font-semibold transition-colors disabled:opacity-50"
                >
                  Pagar
                </button>
              </td>
            </tr>
            <tr v-if="cuentasFiltradas.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400">Sin cuentas</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <!-- Modal nueva factura -->
    <Teleport to="body">
      <div
        v-if="modalAbierto"
        class="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
        @click.self="modalAbierto = false"
      >
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
          <h3 class="text-base font-bold text-gray-800 mb-4">Nueva factura</h3>
          <form @submit.prevent="guardarCuenta" class="space-y-3">
            <div>
              <label class="text-xs text-gray-500">Proveedor *</label>
              <select v-model="form.id_proveedor" required
                class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                <option value="">Seleccioná un proveedor</option>
                <option v-for="prov in proveedoresStore.proveedores" :key="prov.id" :value="prov.id">
                  {{ prov.nombre }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs text-gray-500">N° Factura *</label>
              <input v-model="form.nro_factura" type="text" required
                class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label class="text-xs text-gray-500">Monto total *</label>
              <input v-model.number="form.monto_total" type="number" min="1" required
                class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label class="text-xs text-gray-500">Fecha de vencimiento *</label>
              <input v-model="form.fecha_vencimiento" type="date" required
                class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <p v-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</p>
            <div class="flex gap-3 pt-1">
              <button type="button" @click="modalAbierto = false"
                class="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" :disabled="!formularioValido"
                class="flex-1 py-2.5 bg-green-500 text-white font-semibold rounded-xl text-sm disabled:opacity-50 hover:bg-green-600 transition-colors">
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
