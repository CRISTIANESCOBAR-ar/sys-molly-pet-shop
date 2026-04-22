<script setup>
import { computed } from 'vue'
import { DIAS_PRECIO_DESACTUALIZADO } from '@/firebase/constants'

const props = defineProps({
  producto: { type: Object, required: true },
})

const emit = defineEmits(['editar', 'agregar-carrito'])

const precioViejo = computed(() => {
  if (!props.producto.ultima_actualizacion) return true
  const ts = props.producto.ultima_actualizacion?.toDate
    ? props.producto.ultima_actualizacion.toDate()
    : new Date(props.producto.ultima_actualizacion)
  return (Date.now() - ts.getTime()) > DIAS_PRECIO_DESACTUALIZADO * 24 * 60 * 60 * 1000
})

const stockBajo = computed(() =>
  props.producto.stock <= props.producto.stock_minimo,
)

const ventaFraccionada = computed(() =>
  Boolean(props.producto.venta_granel ?? props.producto.granel ?? false),
)

function formatPrecio(valor) {
  return (valor ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}
</script>

<template>
  <div
    class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3"
    :class="{ 'border-red-100': stockBajo }"
  >
    <!-- Imagen / placeholder -->
    <div class="w-14 h-14 rounded-lg bg-gray-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
      <img
        v-if="producto.img_url"
        :src="producto.img_url"
        :alt="producto.nombre"
        class="w-full h-full object-cover"
        loading="lazy"
      />
      <span v-else class="text-2xl select-none">🐾</span>
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <!-- Nombre + badges -->
      <div class="flex items-start justify-between gap-2">
        <h3 class="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">
          {{ producto.nombre }}
        </h3>
        <div class="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
          <span
            v-if="ventaFraccionada"
            class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
          >
            Fraccionado
          </span>
          <span
            v-if="precioViejo"
            class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
          >
            ⚠ Precio viejo
          </span>
          <span
            v-if="stockBajo"
            class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium"
          >
            Stock bajo
          </span>
        </div>
      </div>

      <!-- Meta -->
      <p class="text-xs text-gray-400 mt-0.5 truncate">
        {{ producto.categoria }} · {{ producto.proveedor || 'Sin proveedor' }}
        <span v-if="ventaFraccionada" class="ml-1 text-blue-500 font-medium">· kg</span>
      </p>

      <!-- Precio + acciones -->
      <div class="flex items-center justify-between mt-2">
        <div>
          <span class="text-base font-bold text-gray-900">{{ formatPrecio(producto.precio_venta) }}</span>
          <span class="text-xs text-gray-400 ml-2">Stock: {{ producto.stock }}</span>
        </div>
        <div class="flex gap-2">
          <button
            @click="emit('editar', producto)"
            class="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-medium active:bg-gray-200 border border-gray-200 transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 3.487a2.1 2.1 0 113 2.972L8.57 17.752 4 19l1.248-4.57L16.862 3.487z" />
            </svg>
            Editar
          </button>
          <button
            @click="emit('agregar-carrito', producto)"
            class="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg font-medium active:bg-green-600 transition-colors"
          >
            + Venta
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
