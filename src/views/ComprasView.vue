<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useComprasStore }   from '@/stores/useComprasStore'
import { useProductosStore } from '@/stores/useProductosStore'
import { useProveedoresStore } from '@/stores/useProveedoresStore'
import { useAuthStore }       from '@/stores/useAuthStore'
import { useSyncQueueStore, esErrorRecuperable } from '@/stores/useSyncQueueStore'

const comprasStore   = useComprasStore()
const productosStore = useProductosStore()
const proveedoresStore = useProveedoresStore()
const authStore      = useAuthStore()
const syncQueueStore = useSyncQueueStore()

// ─── Filtro por período ───────────────────────────────────────────────────────
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

// ─── Suscripción dinámica ─────────────────────────────────────────────────────
let unsubProductos, unsubProv
const loadingCompras = ref(false)

async function cargarPeriodo(options = {}) {
  loadingCompras.value = true
  const inicio = new Date(periodo.value.year, periodo.value.month - 1, 1)
  const fin    = new Date(periodo.value.year, periodo.value.month, 0, 23, 59, 59, 999)
  try {
    await comprasStore.initPeriodo(inicio, fin, options)
  } finally {
    loadingCompras.value = false
  }
}

onMounted(() => {
  unsubProductos = productosStore.subscribe()
  unsubProv = proveedoresStore.subscribeProveedores()
  cargarPeriodo({ force: true })
  window.addEventListener('keydown', onKeydownModalCompra, true)
})

watch(periodo, () => {
  cargarPeriodo({ force: true })
}, { deep: true })

onUnmounted(() => {
  unsubProductos?.()
  unsubProv?.()
  window.removeEventListener('keydown', onKeydownModalCompra, true)
})

function cargarMasCompras() {
  comprasStore.loadMorePeriodo()
}

// ─── Formulario nueva compra ──────────────────────────────────────────────────
const proveedoresOpciones = computed(() => {
  const unicos = [...new Set(
    proveedoresStore.proveedores
      .map(p => String(p.nombre || '').trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b, 'es'))

  if (!unicos.includes('OTRO')) unicos.push('OTRO')
  return unicos.length ? unicos : ['OTRO']
})

const proveedoresOpcionesEdicion = computed(() => {
  const base = new Set(
    proveedoresStore.proveedores
      .map(p => String(p.nombre || '').trim().toUpperCase())
      .filter(Boolean),
  )

  const actual = String(formEditarCompra.value.proveedor || '').trim().toUpperCase()
  if (actual && actual !== 'OTRO') base.add(actual)

  const ordenados = [...base]
    .filter(p => p !== 'DESCONOCIDO')
    .sort((a, b) => a.localeCompare(b, 'es'))

  return ['DESCONOCIDO', ...ordenados, 'OTRO']
})

// ─── Tab mobile ───────────────────────────────────────────────────────────────
const tabActivo = ref('form') // 'form' | 'historial'

const form = ref({
  nombre:        '',
  cantidad:      1,
  presentacion:  '',
  precio_compra: '',
  precio_venta:  '',
  proveedor:     '',
})

const busquedaProducto = ref('')
const mostrarSugerencias = ref(false)

const productosSugeridos = computed(() => {
  const q = busquedaProducto.value.trim().toLowerCase()
  if (!q || q.length < 2) return []
  return productosStore.productos
    .filter(p => p.nombre.toLowerCase().includes(q))
    .slice(0, 6)
})

function seleccionarProducto(prod) {
  form.value.nombre       = prod.nombre
  form.value.precio_venta = prod.precio_venta ?? ''
  busquedaProducto.value  = prod.nombre
  mostrarSugerencias.value = false
}

const guardando  = ref(false)
const exitoGuard = ref(false)
const enColaGuard = ref(false)
const errorGuard = ref('')

const puedeGuardar = computed(() =>
  form.value.nombre.trim() &&
  form.value.cantidad > 0 &&
  Number(form.value.precio_compra) > 0,
)

async function guardarCompra() {
  if (!puedeGuardar.value || guardando.value) return
  guardando.value = true
  errorGuard.value = ''
  enColaGuard.value = false
  try {
    const productoCoincidente = productosStore.productos.find(
      p => p.nombre.toUpperCase() === form.value.nombre.trim().toUpperCase(),
    )
    const compraData = {
      nombre:        form.value.nombre,
      cantidad:      Number(form.value.cantidad),
      presentacion:  form.value.presentacion,
      precio_compra: Number(form.value.precio_compra),
      precio_venta:  Number(form.value.precio_venta) || 0,
      proveedor:     form.value.proveedor,
      producto_id:   productoCoincidente?.id || null,
    }

    await comprasStore.registrarCompra(compraData)

    // Reset form
    form.value = { nombre: '', cantidad: 1, presentacion: '', precio_compra: '', precio_venta: '', proveedor: '' }
    busquedaProducto.value = ''
    exitoGuard.value = true
    setTimeout(() => { exitoGuard.value = false }, 2500)
  } catch (e) {
    if (esErrorRecuperable(e)) {
      const productoCoincidente = productosStore.productos.find(
        p => p.nombre.toUpperCase() === form.value.nombre.trim().toUpperCase(),
      )
      syncQueueStore.addCompra({
        nombre:        form.value.nombre,
        cantidad:      Number(form.value.cantidad),
        presentacion:  form.value.presentacion,
        precio_compra: Number(form.value.precio_compra),
        precio_venta:  Number(form.value.precio_venta) || 0,
        proveedor:     form.value.proveedor,
        producto_id:   productoCoincidente?.id || null,
      })
      form.value = { nombre: '', cantidad: 1, presentacion: '', precio_compra: '', precio_venta: '', proveedor: '' }
      busquedaProducto.value = ''
      enColaGuard.value = true
      setTimeout(() => { enColaGuard.value = false }, 6000)
    } else {
      errorGuard.value = e.message || 'Error al guardar'
    }
  } finally {
    guardando.value = false
  }
}

// ─── Editar / Eliminar compra ─────────────────────────────────────────────────
const modalEditarCompraAbierto = ref(false)
const compraEditando           = ref(null)
const formEditarCompra         = ref({
  nombre: '',
  cantidad: 1,
  presentacion: '',
  precio_compra: 0,
  precio_venta: 0,
  proveedor: '',
  proveedor_otro: '',
})
const guardandoEdicion         = ref(false)

function abrirEditarCompra(compra) {
  compraEditando.value = compra
  formEditarCompra.value = {
    nombre:        compra.nombre        ?? '',
    cantidad:      compra.cantidad      ?? 1,
    presentacion:  compra.presentacion  ?? '',
    precio_compra: compra.precio_compra ?? 0,
    precio_venta:  compra.precio_venta  ?? 0,
    proveedor:     String(compra.proveedor || '').trim().toUpperCase() || 'DESCONOCIDO',
    proveedor_otro: '',
  }
  modalEditarCompraAbierto.value = true
}

function cerrarEditarCompra() {
  modalEditarCompraAbierto.value = false
  compraEditando.value = null
}

function onKeydownModalCompra(e) {
  if (e.key !== 'Escape' || !modalEditarCompraAbierto.value) return
  e.preventDefault()
  e.stopPropagation()
  cerrarEditarCompra()
}

async function guardarEdicionCompra() {
  if (!compraEditando.value || guardandoEdicion.value) return
  guardandoEdicion.value = true
  try {
    const proveedorElegido = String(formEditarCompra.value.proveedor || '').trim().toUpperCase()
    const proveedorFinal = proveedorElegido === 'OTRO'
      ? String(formEditarCompra.value.proveedor_otro || '').trim().toUpperCase()
      : proveedorElegido

    const datos = {
      nombre:        String(formEditarCompra.value.nombre || compraEditando.value.nombre || '').trim().toUpperCase(),
      cantidad:      Number(formEditarCompra.value.cantidad),
      presentacion:  String(formEditarCompra.value.presentacion || '').trim(),
      precio_compra: Number(formEditarCompra.value.precio_compra),
      precio_venta:  Number(formEditarCompra.value.precio_venta),
      proveedor:     proveedorFinal || 'DESCONOCIDO',
      total:         Number(formEditarCompra.value.precio_compra) * Number(formEditarCompra.value.cantidad),
    }
    await comprasStore.actualizarCompra(compraEditando.value.id, datos)
    cerrarEditarCompra()
  } catch (e) {
    console.error(e)
  } finally {
    guardandoEdicion.value = false
  }
}

async function eliminarCompra(compra) {
  const ok = window.confirm(`¿Eliminar compra de ${compra.nombre} por $${Number(compra.total ?? 0).toLocaleString('es-AR')}?`)
  if (!ok) return
  await comprasStore.eliminarCompra(compra.id)
}
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-50">
    <NavBar />

    <!-- Tab switcher mobile -->
    <div class="md:hidden flex border-b border-gray-100 bg-white">
      <button
        @click="tabActivo = 'form'"
        :class="['flex-1 py-2.5 text-sm font-semibold transition-colors', tabActivo === 'form' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-400']"
      >Nueva compra</button>
      <button
        @click="tabActivo = 'historial'"
        :class="['flex-1 py-2.5 text-sm font-semibold transition-colors', tabActivo === 'historial' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-400']"
      >Historial</button>
    </div>

    <div class="flex-1 min-h-0 md:grid md:grid-cols-2 md:gap-0 flex flex-col">

      <!-- Panel izquierdo: Formulario nueva compra -->
      <div :class="['flex-col flex-1 min-h-0 bg-white md:border-r md:border-gray-100 overflow-y-auto', tabActivo === 'form' ? 'flex' : 'hidden md:flex']">
        <div class="px-4 pt-4 pb-2">
          <h2 class="text-base font-bold text-gray-800">Nueva compra</h2>
        </div>

        <div class="px-4 pb-6 space-y-4">

          <!-- Producto -->
          <div class="relative">
            <label class="block text-xs font-medium text-gray-500 mb-1">Producto</label>
            <input
              v-model="busquedaProducto"
              @input="mostrarSugerencias = true; form.nombre = busquedaProducto"
              @blur="setTimeout(() => mostrarSugerencias = false, 150)"
              @focus="mostrarSugerencias = true"
              type="text"
              placeholder="Buscar o escribir nombre..."
              class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <!-- Sugerencias -->
            <div
              v-if="mostrarSugerencias && productosSugeridos.length > 0"
              class="absolute z-20 left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
            >
              <button
                v-for="p in productosSugeridos"
                :key="p.id"
                @mousedown.prevent="seleccionarProducto(p)"
                class="w-full text-left px-3 py-2 text-sm hover:bg-green-50 border-b border-gray-50 last:border-0"
              >
                <span class="font-medium text-gray-800">{{ p.nombre }}</span>
                <span class="ml-2 text-xs text-green-600">${{ (p.precio_venta ?? 0).toLocaleString('es-AR') }}</span>
              </button>
            </div>
          </div>

          <!-- Cantidad + Presentación -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Cantidad</label>
              <input
                v-model.number="form.cantidad"
                type="number" min="1"
                class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Presentación</label>
              <input
                v-model="form.presentacion"
                type="text" placeholder="ej: 20 KG"
                class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          </div>

          <!-- Precio compra + venta -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Precio compra $</label>
              <input
                v-model.number="form.precio_compra"
                type="number" min="0" placeholder="0"
                class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Precio venta $</label>
              <input
                v-model.number="form.precio_venta"
                type="number" min="0" placeholder="0"
                class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <p class="text-xs text-gray-400 mt-0.5">Actualiza el producto automáticamente</p>
            </div>
          </div>

          <!-- Proveedor -->
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Proveedor</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="prov in proveedoresOpciones"
                :key="prov"
                @click="form.proveedor = prov"
                :class="[
                  'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                  form.proveedor === prov
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-300',
                ]"
              >{{ prov }}</button>
            </div>
          </div>

          <!-- Total preview -->
          <div v-if="form.precio_compra > 0 && form.cantidad > 0" class="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center">
            <span class="text-sm text-gray-500">Total a pagar</span>
            <span class="text-base font-bold text-gray-900">
              ${{ (Number(form.precio_compra) * Number(form.cantidad)).toLocaleString('es-AR') }}
            </span>
          </div>

          <!-- Error -->
          <p v-if="errorGuard" class="text-xs text-red-500">{{ errorGuard }}</p>

          <!-- Flash éxito -->
          <div v-if="exitoGuard" class="text-center text-sm font-semibold text-green-600 bg-green-50 rounded-xl py-3">
            ✓ Compra registrada
          </div>

          <!-- Guardado en cola offline -->
          <div v-else-if="enColaGuard" class="text-center text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl py-3 px-3">
            ⏳ Sin acceso — compra guardada para sincronizar
          </div>

          <!-- Botón guardar -->
          <button
            v-else
            @click="guardarCompra"
            :disabled="!puedeGuardar || guardando"
            class="w-full py-3.5 bg-green-500 text-white font-bold rounded-xl text-sm disabled:opacity-40 active:bg-green-600 transition-colors"
          >
            {{ guardando ? 'Guardando...' : 'Registrar compra' }}
          </button>

        </div>
      </div>

      <!-- Panel derecho: historial -->
      <div :class="['flex-col flex-1 min-h-0 relative', tabActivo === 'historial' ? 'flex' : 'hidden md:flex']">

        <!-- Overlay carga -->
        <Transition name="fade">
          <div
            v-if="loadingCompras"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm"
          >
            <svg class="animate-spin h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
            <p class="text-sm text-gray-500 font-medium">Cargando {{ periodoLabel }}…</p>
          </div>
        </Transition>

        <!-- CABECERA FIJA: navegación mes + resumen -->
        <div class="flex-shrink-0 px-4 pt-4 md:px-6 md:pt-6 pb-3 bg-gray-50 border-b border-gray-100">
          <!-- Navegación mes -->
          <div class="flex items-center justify-between mb-3">
              <button @click="anteriorMes" class="w-14 h-14 flex items-center justify-center rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-3xl font-bold transition-colors active:bg-gray-400">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2.75" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            <h2 class="text-lg font-bold text-gray-800 capitalize">{{ periodoLabel }}</h2>
              <button @click="siguienteMes" :disabled="esMesActual" class="w-14 h-14 flex items-center justify-center rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-3xl font-bold transition-colors active:bg-gray-400 disabled:opacity-30">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2.75" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
                </svg>
              </button>
          </div>
          <!-- Resumen -->
          <div v-if="comprasStore.compras.length > 0" class="bg-white rounded-xl px-4 py-3 space-y-1.5 shadow-sm">
            <div class="flex justify-between items-baseline">
              <span class="text-base text-gray-500">{{ comprasStore.compras.length }} compras</span>
              <span class="text-2xl font-bold text-green-700">${{ comprasStore.totalPeriodo.toLocaleString('es-AR') }}</span>
            </div>
            <div
              v-for="(monto, prov) in comprasStore.porProveedor"
              :key="prov"
              class="flex justify-between text-base text-gray-500"
            >
              <span>{{ prov }}</span>
              <span>${{ monto.toLocaleString('es-AR') }}</span>
            </div>
          </div>
          <p v-else class="text-base text-gray-400">Sin compras en este período</p>
        </div>

        <!-- LISTA SCROLLEABLE -->
        <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-4 md:px-6">
        <div
          v-for="compra in comprasStore.comprasMostradas"
          :key="compra.id"
          class="bg-white rounded-xl border border-gray-100 p-4 mb-3 shadow-sm"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="text-base text-gray-400">
              {{ compra.fecha?.toDate ? compra.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—' }}
            </span>
            <span class="text-base font-semibold bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
              {{ compra.proveedor || 'Sin proveedor' }}
            </span>
          </div>
          <p class="text-lg font-bold text-gray-800 truncate">{{ compra.nombre }}</p>
          <div class="flex justify-between items-end mt-2">
            <div class="text-base text-gray-400 space-y-0.5">
              <p>×{{ compra.cantidad }} {{ compra.presentacion }}</p>
              <p>Compra: ${{ (compra.precio_compra ?? 0).toLocaleString('es-AR') }} · Venta: ${{ (compra.precio_venta ?? 0).toLocaleString('es-AR') }}</p>
            </div>
            <span class="text-xl font-bold text-gray-900">${{ (compra.total ?? 0).toLocaleString('es-AR') }}</span>
          </div>
          <p v-if="compra.usuario_email" class="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
            <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>
            {{ compra.usuario_email }}
          </p>
          <div v-if="authStore.isAdmin" class="flex justify-end gap-2 mt-3">
            <button
              @click="abrirEditarCompra(compra)"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 border border-gray-200 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 3.487a2.1 2.1 0 113 2.972L8.57 17.752 4 19l1.248-4.57L16.862 3.487z" />
              </svg>
              Editar
            </button>
            <button
              @click="eliminarCompra(compra)"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200 border border-red-200 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12M10 7V5a1 1 0 011-1h2a1 1 0 011 1v2m-7 0v11a1 1 0 001 1h8a1 1 0 001-1V7M10 11v6m4-6v6" />
              </svg>
              Eliminar
            </button>
          </div>
        </div>

        <div class="py-2">
          <button
            v-if="comprasStore.hasMorePeriodo"
            @click="cargarMasCompras"
            class="w-full py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Cargar más compras ({{ comprasStore.comprasActivas.length - comprasStore.comprasMostradas.length }} restantes)
          </button>
        </div>
        </div><!-- fin lista scrolleable -->

      </div>
    </div>
  </div>

  <!-- Modal edición compra (solo admin) -->
  <Teleport to="body">
    <div
      v-if="modalEditarCompraAbierto"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      @click.self="cerrarEditarCompra"
      @keydown.esc.prevent.stop="cerrarEditarCompra"
    >
      <div class="bg-white w-full max-w-md rounded-xl shadow-xl flex flex-col" style="max-height: min(90vh, 640px)">

        <!-- Header fijo -->
        <div class="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <h3 class="text-base font-bold text-gray-800">Editar compra</h3>
          <button
            type="button"
            @click="cerrarEditarCompra"
            aria-label="Cerrar modal"
            class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >✕</button>
        </div>

        <!-- Contenido scrolleable -->
        <div class="overflow-y-auto flex-1 px-5 py-4 space-y-3">

          <!-- Producto -->
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Producto</label>
            <input v-model="formEditarCompra.nombre" type="text" placeholder="Nombre del producto"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>

          <!-- Cantidad + Presentación -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Cantidad</label>
              <input v-model.number="formEditarCompra.cantidad" type="number" min="1"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Presentación</label>
              <input v-model="formEditarCompra.presentacion" type="text" placeholder="ej: 20 KG"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>

          <!-- Precio compra + Precio venta -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Precio compra $</label>
              <input v-model.number="formEditarCompra.precio_compra" type="number" min="0"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Precio venta $</label>
              <input v-model.number="formEditarCompra.precio_venta" type="number" min="0"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>

          <!-- Proveedor -->
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Proveedor</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="prov in proveedoresOpcionesEdicion"
                :key="prov"
                @click="formEditarCompra.proveedor = prov; if (prov !== 'OTRO') formEditarCompra.proveedor_otro = ''"
                :class="[
                  'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors',
                  formEditarCompra.proveedor === prov
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-300',
                ]"
              >{{ prov }}</button>
            </div>
            <input
              v-if="formEditarCompra.proveedor === 'OTRO'"
              v-model="formEditarCompra.proveedor_otro"
              type="text"
              placeholder="Escribir proveedor"
              class="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <!-- Total -->
          <div class="bg-gray-50 rounded-lg px-3 py-2 flex justify-between text-sm">
            <span class="text-gray-500">Total</span>
            <span class="font-bold text-gray-900">${{ (formEditarCompra.precio_compra * formEditarCompra.cantidad).toLocaleString('es-AR') }}</span>
          </div>

        </div>

        <!-- Botones fijos abajo -->
        <div class="flex gap-2 px-5 py-3 border-t border-gray-100 flex-shrink-0">
          <button @click="cerrarEditarCompra"
            class="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            ↩️ Cancelar
          </button>
          <button @click="guardarEdicionCompra" :disabled="guardandoEdicion"
            class="flex-1 py-2.5 rounded-lg bg-green-500 text-white text-sm font-bold hover:bg-green-600 disabled:opacity-50">
            {{ guardandoEdicion ? '⏳ Guardando...' : '💾 Guardar' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
