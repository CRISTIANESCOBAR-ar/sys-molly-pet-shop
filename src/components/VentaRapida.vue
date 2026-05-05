<script setup>
import { ref, computed } from 'vue'
import { useVentasStore }      from '@/stores/useVentasStore'
import { useProductosStore }   from '@/stores/useProductosStore'
import CarritoDrawer           from '@/components/CarritoDrawer.vue'

const ventasStore    = useVentasStore()
const productosStore = useProductosStore()

const busqueda = ref('')

// ─── Filtro de productos ────────────────────────────────────────────────────
const productosFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return productosStore.productos
  return productosStore.productos.filter(p =>
    p.nombre.toLowerCase().includes(q),
  )
})

// ─── Modal de cantidad (granel) ─────────────────────────────────────────────
const productoSeleccionado = ref(null)
const inputCantidad        = ref('')

const previewTotal = computed(() => {
  if (!productoSeleccionado.value) return 0
  const qty = cantidadCalculada.value
  return Math.round(qty * (productoSeleccionado.value.precio_venta ?? 0))
})

const modoIngreso = ref('kg') // 'kg' | 'unid' | 'importe'

function esGranel(producto) {
  return Boolean(producto?.venta_granel ?? producto?.granel ?? false)
}

// Modo base según tipo de producto: 'kg' para granel, 'unid' para los demás
const modoBase = computed(() =>
  productoSeleccionado.value && esGranel(productoSeleccionado.value) ? 'kg' : 'unid',
)

const cantidadCalculada = computed(() => {
  const valor = parseFloat(inputCantidad.value) || 0
  if (!productoSeleccionado.value || valor <= 0) return 0

  // Si el usuario ingresa cantidad directa (kg o unid), respetar lo ingresado
  if (modoIngreso.value === 'kg' || modoIngreso.value === 'unid') {
    // Para kg/unid ingresados directamente, no forzamos redondeos aquí
    return modoIngreso.value === 'kg'
      ? parseFloat((Math.floor(valor * 1000) / 1000).toFixed(3)) // truncar kg a 3 decimales
      : valor
  }

  // Modo 'importe' (usuario ingresa $)
  const precio = Number(productoSeleccionado.value.precio_venta ?? 0)
  if (precio <= 0) return 0

  if (esGranel(productoSeleccionado.value)) {
    // Para granel: calcular kg = importe / precio y TRUNCAR a 3 decimales
    const rawQty = valor / precio
    const trunc = Math.floor(rawQty * 1000) / 1000
    return parseFloat(trunc.toFixed(3))
  }

  // Para productos por unidad: convertir a unidades ENTERAS sin redondear hacia arriba
  // (asegura que qty * precio <= importe)
  const unidades = Math.floor(valor / precio)
  return unidades
})

// Todos los productos abren el modal — granel con 'kg', el resto con 'unid'
function handleProductoClick(producto) {
  productoSeleccionado.value = producto
  inputCantidad.value = ''
  modoIngreso.value = esGranel(producto) ? 'kg' : 'unid'
}

const TECLAS = ['7','8','9','4','5','6','1','2','3','.','0','⌫']

function presionarTecla(key) {
  if (key === '⌫') {
    inputCantidad.value = inputCantidad.value.slice(0, -1)
    return
  }
  if (key === '.') {
    if (inputCantidad.value.includes('.')) return
    inputCantidad.value = (inputCantidad.value || '0') + '.'
    return
  }
  // Máximo 3 decimales en kg/unid, 2 en importe
  const maxDecimales = modoIngreso.value === 'importe' ? 2 : 3
  const partes = inputCantidad.value.split('.')
  if (partes[1] !== undefined && partes[1].length >= maxDecimales) return
  // Evitar ceros a la izquierda
  if (inputCantidad.value === '0') {
    inputCantidad.value = key
    return
  }
  inputCantidad.value += key
}

function confirmarCantidad() {
  const qty = cantidadCalculada.value
  if (!qty || qty <= 0) return
  ventasStore.agregarAlCarrito(productoSeleccionado.value, qty)
  productoSeleccionado.value = null
  inputCantidad.value = ''
  modoIngreso.value = 'kg'
}

function cancelarModal() {
  productoSeleccionado.value = null
  inputCantidad.value = ''
  modoIngreso.value = 'kg' // se sobreescribe al abrir el próximo modal
}

// ─── Confirmar venta (delegado a CarritoDrawer) ─────────────────────────────
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">

    <!-- ── Búsqueda ─────────────────────────────────────────────────────── -->
    <div class="p-4 pb-2">
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          v-model="busqueda"
          type="search"
          placeholder="Buscar producto..."
          class="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>
    </div>

    <!-- ── Lista de productos ────────────────────────────────────────────── -->
    <div class="flex-1 overflow-y-auto px-4 space-y-2 pb-2">
      <p v-if="productosFiltrados.length === 0" class="text-sm text-gray-400 text-center py-6">
        Sin resultados
      </p>
      <button
        v-for="producto in productosFiltrados"
        :key="producto.id"
        @click="handleProductoClick(producto)"
        class="w-full text-left bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between shadow-sm active:bg-green-50 transition-colors"
      >
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-800 truncate">{{ producto.nombre }}</p>
          <p class="text-xs text-gray-400 mt-0.5">
            Stock: {{ producto.stock }}
            <span v-if="esGranel(producto)" class="ml-1 text-blue-400 font-medium">· kg</span>
            · {{ producto.categoria }}
          </p>
        </div>
        <span class="text-sm font-bold text-green-600 flex-shrink-0 ml-2">
          ${{ (producto.precio_venta ?? 0).toLocaleString('es-AR') }}
          <span v-if="esGranel(producto)" class="text-xs font-normal text-gray-400">/kg</span>
        </span>
      </button>
    </div>

    <!-- CarritoDrawer maneja el carrito, totales y confirmación -->
    <CarritoDrawer />

  </div>

  <!-- ── Modal teclado numérico (granel) ──────────────────────────────────── -->
  <Teleport to="body">
    <div
      v-if="productoSeleccionado"
      class="fixed inset-0 z-50 flex items-end bg-black/50"
      @click.self="cancelarModal"
    >
      <div class="bg-white w-full rounded-t-2xl p-5 space-y-4 max-w-sm mx-auto">

        <!-- Cabecera -->
        <div class="flex items-center justify-between">
          <div class="min-w-0 pr-2">
            <p class="font-semibold text-gray-800 truncate">{{ productoSeleccionado.nombre }}</p>
            <p class="text-xs text-gray-400">
              {{ esGranel(productoSeleccionado) ? 'Elegí ingreso por kg o por importe directo' : 'Podés ingresar fracciones de unidad (ej: 0.5)' }}
            </p>
          </div>
          <button @click="cancelarModal" class="text-gray-400 text-xl leading-none flex-shrink-0">✕</button>
        </div>

        <!-- Modo de ingreso -->
        <div class="grid grid-cols-2 gap-2">
          <button
            @click="modoIngreso = modoBase; inputCantidad = ''"
            :class="[
              'py-2.5 rounded-xl text-xs font-semibold border transition-colors',
              modoIngreso === modoBase
                ? 'bg-green-500 text-white border-green-500'
                : 'bg-white text-gray-600 border-gray-200',
            ]"
          >
            {{ modoBase === 'kg' ? 'Por kg' : 'Por unid.' }}
          </button>
          <button
            @click="modoIngreso = 'importe'; inputCantidad = ''"
            :class="[
              'py-2.5 rounded-xl text-xs font-semibold border transition-colors',
              modoIngreso === 'importe'
                ? 'bg-green-500 text-white border-green-500'
                : 'bg-white text-gray-600 border-gray-200',
            ]"
          >
            Por importe
          </button>
        </div>

        <!-- Display -->
        <div class="bg-gray-50 rounded-xl px-4 py-3 text-right">
          <p class="text-3xl font-bold tracking-tight text-gray-900 font-mono">
            {{ inputCantidad || '0' }}
            <span class="text-lg font-normal text-gray-400">{{
              modoIngreso === 'kg' ? ' kg' : modoIngreso === 'unid' ? ' unid.' : ' $'
            }}</span>
          </p>
          <p v-if="modoIngreso === 'importe' && esGranel(productoSeleccionado) && cantidadCalculada > 0" class="text-xs text-gray-500 mt-0.5">
            = {{ cantidadCalculada.toFixed(3) }} kg
          </p>
          <p v-if="previewTotal > 0" class="text-sm text-green-600 font-semibold mt-0.5">
            = ${{ previewTotal.toLocaleString('es-AR') }}
          </p>
        </div>

        <!-- Teclado -->
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="tecla in TECLAS"
            :key="tecla"
            @click="presionarTecla(tecla)"
            :class="[
              'py-4 rounded-xl text-xl font-semibold transition-colors active:scale-95',
              tecla === '⌫'
                ? 'bg-red-50 text-red-500 active:bg-red-100'
                : tecla === '.'
                  ? 'bg-blue-50 text-blue-600 active:bg-blue-100'
                  : 'bg-gray-100 text-gray-800 active:bg-gray-200',
            ]"
          >
            {{ tecla }}
          </button>
        </div>

        <!-- Botón agregar -->
        <button
          @click="confirmarCantidad"
          :disabled="!cantidadCalculada || cantidadCalculada <= 0"
          class="w-full py-3.5 bg-green-500 text-white font-bold rounded-xl text-sm disabled:opacity-40 active:bg-green-600 transition-colors"
        >
          Agregar {{ cantidadCalculada > 0 ? `${cantidadCalculada.toFixed(3)} ${modoBase === 'kg' ? 'kg' : 'unid.'}` : '' }} al carrito
        </button>

      </div>
    </div>
  </Teleport>

</template>
