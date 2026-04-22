<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import NavBar    from '@/components/NavBar.vue'
import StockCard from '@/components/StockCard.vue'
import { useProductosStore } from '@/stores/useProductosStore'
import { useAuthStore }      from '@/stores/useAuthStore'
import { CATEGORIAS }        from '@/firebase/constants'

const productosStore = useProductosStore()
const authStore      = useAuthStore()

let unsubProductos

onMounted(() => { unsubProductos = productosStore.subscribe() })
onUnmounted(() => unsubProductos?.())

// ─── Filtros ────────────────────────────────────────────────────────────────
const busqueda       = ref('')
const filtroCategoria = ref('')
const soloStockBajo  = ref(false)

const productosFiltrados = computed(() => {
  return productosStore.productos.filter(p => {
    const matchNombre    = p.nombre.toLowerCase().includes(busqueda.value.toLowerCase())
    const matchCategoria = !filtroCategoria.value || p.categoria === filtroCategoria.value
    const matchStock     = !soloStockBajo.value || p.stock <= p.stock_minimo
    return matchNombre && matchCategoria && matchStock
  })
})

// ─── Modal de edición ───────────────────────────────────────────────────────
const modalAbierto = ref(false)
const editando     = ref(null)
const formProducto = ref({
  nombre: '', sku: '', categoria: '', proveedor: '',
  precio_compra: 0, precio_venta: 0, stock: 0, stock_minimo: 0,
  venta_granel: false,
})
let scrollYAntesModal = 0

// Validación reactiva
const formularioValido = computed(() =>
  formProducto.value.nombre.trim().length > 0 &&
  formProducto.value.precio_venta >= 0,
)

function abrirEditar(producto) {
  editando.value = producto
  formProducto.value = {
    ...producto,
    venta_granel: Boolean(producto.venta_granel ?? producto.granel ?? false),
  }
  modalAbierto.value = true
}

function abrirNuevo() {
  editando.value = null
  formProducto.value = {
    nombre: '', sku: '', categoria: CATEGORIAS[0], proveedor: '',
    precio_compra: 0, precio_venta: 0, stock: 0, stock_minimo: 0,
    venta_granel: false,
  }
  modalAbierto.value = true
}

async function guardarProducto() {
  if (!formularioValido.value) return
  if (editando.value) {
    await productosStore.actualizar(editando.value.id, formProducto.value)
  } else {
    await productosStore.agregar(formProducto.value)
  }
  modalAbierto.value = false
}

// ─── Edición rápida de stock (desktop) ─────────────────────────────────────
const editandoStock = ref(null)
const nuevoStock    = ref(0)

function iniciarEditarStock(producto) {
  editandoStock.value = producto.id
  nuevoStock.value    = producto.stock
}

async function confirmarStock(id) {
  await productosStore.actualizarStock(id, Number(nuevoStock.value))
  editandoStock.value = null
}

watch(modalAbierto, abierto => {
  if (typeof document === 'undefined') return

  if (abierto) {
    scrollYAntesModal = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollYAntesModal}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
    return
  }

  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.left = ''
  document.body.style.right = ''
  document.body.style.width = ''
  document.body.style.overflow = ''
  window.scrollTo(0, scrollYAntesModal)
})

onUnmounted(() => {
  if (typeof document === 'undefined') return
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.left = ''
  document.body.style.right = ''
  document.body.style.width = ''
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="flex flex-col min-h-screen bg-gray-50">
    <NavBar />

    <main class="flex-1 max-w-7xl mx-auto w-full px-4 py-6">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 class="text-xl font-bold text-gray-800">Stock</h1>
          <p class="text-sm text-gray-400">
            {{ productosStore.productos.length }} productos ·
            <span class="text-red-500">{{ productosStore.productosConStockBajo.length }} stock bajo</span> ·
            <span class="text-yellow-600">{{ productosStore.productosConPrecioViejo.length }} precio viejo</span>
          </p>
        </div>
        <button
          v-if="authStore.isAdmin"
          @click="abrirNuevo"
          class="bg-green-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-green-600 transition-colors"
        >
          + Nuevo producto
        </button>
      </div>

      <!-- Filtros -->
      <div class="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          v-model="busqueda"
          type="search"
          placeholder="Buscar..."
          class="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <select
          v-model="filtroCategoria"
          class="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          <option value="">Todas las categorías</option>
          <option v-for="cat in CATEGORIAS" :key="cat" :value="cat">{{ cat }}</option>
        </select>
        <label class="flex items-center gap-2 text-sm text-gray-600 bg-white px-4 py-2.5 rounded-xl border border-gray-200 cursor-pointer">
          <input v-model="soloStockBajo" type="checkbox" class="accent-red-500" />
          Solo stock bajo
        </label>
      </div>

      <!-- ── Mobile: cards ──────────────────────────────────────────────── -->
      <div class="md:hidden space-y-3">
        <StockCard
          v-for="producto in productosFiltrados"
          :key="producto.id"
          :producto="producto"
          @editar="abrirEditar"
        />
        <p v-if="productosFiltrados.length === 0" class="text-center text-sm text-gray-400 py-8">
          Sin resultados
        </p>
      </div>

      <!-- ── Desktop: tabla densa ───────────────────────────────────────── -->
      <div class="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
            <tr>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Producto</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoría</th>
              <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">P. Venta</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mín.</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
              <th v-if="authStore.isAdmin" class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr
              v-for="producto in productosFiltrados"
              :key="producto.id"
              class="hover:bg-gray-50 transition-colors"
              :class="{ 'bg-red-50/40': producto.stock <= producto.stock_minimo }"
            >
              <td class="px-4 py-3 font-medium text-gray-800">
                {{ producto.nombre }}
                <span
                  v-if="producto.venta_granel ?? producto.granel"
                  class="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
                >
                  Fraccionado
                </span>
                <span v-if="productosStore.productosConPrecioViejo.find(p => p.id === producto.id)"
                  class="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                  ⚠ Precio viejo
                </span>
              </td>
              <td class="px-4 py-3 text-gray-500">{{ producto.categoria }}</td>
              <td class="px-4 py-3 text-right font-semibold text-gray-800">
                ${{ (producto.precio_venta ?? 0).toLocaleString('es-AR') }}
              </td>
              <!-- Stock edición inline -->
              <td class="px-4 py-3 text-center">
                <div v-if="authStore.isAdmin && editandoStock === producto.id" class="flex items-center justify-center gap-1">
                  <input
                    v-model="nuevoStock"
                    type="number"
                    min="0"
                    class="w-16 text-center border border-green-300 rounded-lg px-2 py-1 text-sm focus:outline-none"
                    @keyup.enter="confirmarStock(producto.id)"
                    @keyup.escape="editandoStock = null"
                  />
                  <button @click="confirmarStock(producto.id)" class="text-green-600 font-bold text-sm">✓</button>
                </div>
                <button
                  v-else-if="authStore.isAdmin"
                  @click="iniciarEditarStock(producto)"
                  class="font-semibold text-gray-700 hover:text-green-600 transition-colors"
                >
                  {{ producto.stock }}
                </button>
                <span v-else class="font-semibold text-gray-700">{{ producto.stock }}</span>
              </td>
              <td class="px-4 py-3 text-center text-gray-400">{{ producto.stock_minimo }}</td>
              <td class="px-4 py-3 text-center">
                <span :class="[
                  'text-xs font-semibold px-2 py-1 rounded-full',
                  producto.stock <= producto.stock_minimo
                    ? 'bg-red-100 text-red-600'
                    : 'bg-green-100 text-green-700'
                ]">
                  {{ producto.stock <= producto.stock_minimo ? 'Bajo' : 'OK' }}
                </span>
              </td>
              <td v-if="authStore.isAdmin" class="px-4 py-3 text-right">
                <button
                  @click="abrirEditar(producto)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 border border-gray-200 transition-colors"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 3.487a2.1 2.1 0 113 2.972L8.57 17.752 4 19l1.248-4.57L16.862 3.487z" />
                  </svg>
                  Editar
                </button>
              </td>
            </tr>
            <tr v-if="productosFiltrados.length === 0">
              <td colspan="7" class="px-4 py-8 text-center text-sm text-gray-400">Sin resultados</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <!-- ── Modal nuevo / editar producto ──────────────────────────────────── -->
    <Teleport to="body">
      <div
        v-if="modalAbierto"
        class="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
        @click.self="modalAbierto = false"
      >
        <div class="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
          <h3 class="text-base font-bold text-gray-800 mb-4">
            {{ editando ? 'Editar producto' : 'Nuevo producto' }}
          </h3>
          <form @submit.prevent="guardarProducto" class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div class="col-span-2">
                <label class="text-xs text-gray-500">Nombre *</label>
                <input v-model="formProducto.nombre" type="text" required
                  class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label class="text-xs text-gray-500">SKU</label>
                <input v-model="formProducto.sku" type="text"
                  class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label class="text-xs text-gray-500">Categoría</label>
                <select v-model="formProducto.categoria"
                  class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                  <option v-for="cat in CATEGORIAS" :key="cat" :value="cat">{{ cat }}</option>
                </select>
              </div>
              <div class="col-span-2">
                <label class="text-xs text-gray-500">Proveedor</label>
                <input v-model="formProducto.proveedor" type="text"
                  class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label class="text-xs text-gray-500">Precio compra</label>
                <input v-model.number="formProducto.precio_compra" type="number" min="0"
                  class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label class="text-xs text-gray-500">Precio venta *</label>
                <input v-model.number="formProducto.precio_venta" type="number" min="0" required
                  class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label class="text-xs text-gray-500">Stock actual</label>
                <input v-model.number="formProducto.stock" type="number" min="0"
                  class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label class="text-xs text-gray-500">Stock mínimo</label>
                <input v-model.number="formProducto.stock_minimo" type="number" min="0"
                  class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div class="col-span-2">
                <label class="flex items-center gap-2 mt-1 cursor-pointer select-none">
                  <input
                    v-model="formProducto.venta_granel"
                    type="checkbox"
                    class="w-4 h-4 accent-green-500"
                  />
                  <span class="text-sm text-gray-700 font-medium">Venta fraccionada por kg (permite decimales)</span>
                </label>
                <p class="text-xs text-gray-400 mt-1">
                  Si está activo, en Ventas se abre teclado para cargar kg o importe directo.
                </p>
              </div>
            </div>
            <div class="flex gap-3 pt-2">
              <button type="button" @click="modalAbierto = false"
                class="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
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
