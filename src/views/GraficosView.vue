<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useAuthStore } from '@/stores/useAuthStore'
import { useVentasStore } from '@/stores/useVentasStore'
import { useComprasStore } from '@/stores/useComprasStore'

const authStore = useAuthStore()
const ventasStore = useVentasStore()
const comprasStore = useComprasStore()

const hoy = new Date()
const periodo = ref({ year: hoy.getFullYear(), month: hoy.getMonth() + 1 })
const modo = ref('ventas')
const loading = ref(true)

let unsubVentas
let unsubCompras

const periodoLabel = computed(() => {
  const d = new Date(periodo.value.year, periodo.value.month - 1, 1)
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
})

const esMesActual = computed(() =>
  periodo.value.year === hoy.getFullYear() && periodo.value.month === hoy.getMonth() + 1,
)

const modosDisponibles = computed(() => {
  const items = [{ value: 'ventas', label: 'Ventas', icon: '🛒' }]
  if (authStore.isAdmin) items.push({ value: 'compras', label: 'Compras', icon: '🛍️' })
  return items
})

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

function normalizarFecha(valor) {
  if (!valor) return null
  if (typeof valor.toDate === 'function') return valor.toDate()
  return valor instanceof Date ? valor : null
}

function construirSerie(items) {
  const diasEnMes = new Date(periodo.value.year, periodo.value.month, 0).getDate()
  const puntos = Array.from({ length: diasEnMes }, (_, index) => ({
    day: index + 1,
    total: 0,
    count: 0,
  }))

  for (const item of items) {
    const fecha = normalizarFecha(item.fecha)
    if (!fecha) continue
    const dia = fecha.getDate()
    if (dia < 1 || dia > diasEnMes) continue
    puntos[dia - 1].total += Number(item.total ?? 0)
    puntos[dia - 1].count += 1
  }

  const maxTotal = Math.max(0, ...puntos.map(p => p.total))
  const maxCount = Math.max(0, ...puntos.map(p => p.count))
  const diasConMovimiento = puntos.filter(p => p.count > 0).length
  const totalMes = puntos.reduce((acc, p) => acc + p.total, 0)
  const operaciones = puntos.reduce((acc, p) => acc + p.count, 0)
  const mejorDia = [...puntos].sort((a, b) => b.total - a.total)[0] || { day: 0, total: 0, count: 0 }
  const pasoEtiquetas = diasEnMes > 25 ? 5 : diasEnMes > 14 ? 3 : 2

  return {
    puntos: puntos.map((p, index) => ({
      ...p,
      altura: maxTotal ? Math.max((p.total / maxTotal) * 100, p.total > 0 ? 8 : 0) : 0,
      showLabel: index === 0 || index === diasEnMes - 1 || (index + 1) % pasoEtiquetas === 0,
    })),
    maxTotal,
    maxCount,
    totalMes,
    operaciones,
    diasConMovimiento,
    mejorDia,
    ticketPromedio: operaciones ? totalMes / operaciones : 0,
    promedioDiaActivo: diasConMovimiento ? totalMes / diasConMovimiento : 0,
  }
}

const serieVentas = computed(() => construirSerie(ventasStore.ventas))
const serieCompras = computed(() => construirSerie(comprasStore.compras))
const serieActiva = computed(() => (modo.value === 'compras' ? serieCompras.value : serieVentas.value))

const topDias = computed(() =>
  [...serieActiva.value.puntos]
    .filter(p => p.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5),
)

const lineChart = computed(() => {
  const puntos = serieActiva.value.puntos
  const width = 640
  const height = 220
  const padX = 20
  const padY = 22
  const max = Math.max(serieActiva.value.maxCount, 1)
  const stepX = puntos.length > 1 ? (width - padX * 2) / (puntos.length - 1) : 0

  const coords = puntos.map((point, index) => {
    const x = padX + index * stepX
    const y = height - padY - (point.count / max) * (height - padY * 2)
    return { ...point, x, y }
  })

  return {
    width,
    height,
    polyline: coords.map(point => `${point.x},${point.y}`).join(' '),
    area: coords.length
      ? `M ${coords[0].x} ${height - padY} L ${coords.map(point => `${point.x} ${point.y}`).join(' L ')} L ${coords[coords.length - 1].x} ${height - padY} Z`
      : '',
    coords,
  }
})

function resuscribir() {
  unsubVentas?.()
  unsubCompras?.()
  loading.value = true

  const inicio = new Date(periodo.value.year, periodo.value.month - 1, 1)
  const fin = new Date(periodo.value.year, periodo.value.month, 0, 23, 59, 59, 999)
  let pendientes = authStore.isAdmin ? 2 : 1

  const marcarListo = () => {
    pendientes -= 1
    if (pendientes <= 0) loading.value = false
  }

  unsubVentas = ventasStore.subscribeByPeriodo(inicio, fin, marcarListo)

  if (authStore.isAdmin) {
    unsubCompras = comprasStore.subscribeByPeriodo(inicio, fin, marcarListo)
  }
}

watch(periodo, resuscribir, { deep: true })
watch(() => authStore.isAdmin, esAdmin => {
  if (!esAdmin && modo.value === 'compras') modo.value = 'ventas'
})

onMounted(resuscribir)

onUnmounted(() => {
  unsubVentas?.()
  unsubCompras?.()
})
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-50">
    <NavBar />

    <main class="flex-1 min-h-0 overflow-y-auto">
      <div class="w-full max-w-[1600px] mx-auto px-4 py-4 md:px-6 xl:px-8 md:py-6 space-y-4 md:space-y-6">
        <section class="rounded-3xl bg-white border border-gray-100 shadow-sm p-4 md:p-6">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-green-600">Analitica diaria</p>
              <h1 class="text-2xl md:text-3xl font-bold text-gray-900 mt-1">Ventas y compras por dia</h1>
              <p class="text-sm md:text-base text-gray-500 mt-2">Seguimiento diario del mes actual o historico con una lectura clara en web y mobile.</p>
            </div>

            <div class="flex flex-col gap-3 md:flex-row md:items-center">
              <div class="inline-flex rounded-2xl bg-gray-100 p-1">
                <button
                  v-for="item in modosDisponibles"
                  :key="item.value"
                  @click="modo = item.value"
                  :class="[
                    'px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                    modo === item.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
                  ]"
                >
                  {{ item.icon }} {{ item.label }}
                </button>
              </div>

              <div class="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 border border-gray-100 px-3 py-2.5 min-w-[280px]">
                <button
                  @click="anteriorMes"
                  class="w-11 h-11 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
                  aria-label="Mes anterior"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
                  </svg>
                </button>

                <div class="text-center min-w-0 flex-1">
                  <p class="text-xs text-gray-400 uppercase tracking-[0.16em]">Periodo</p>
                  <p class="text-base md:text-lg font-bold text-gray-900 capitalize truncate">{{ periodoLabel }}</p>
                </div>

                <button
                  @click="siguienteMes"
                  :disabled="esMesActual"
                  class="w-11 h-11 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-30"
                  aria-label="Mes siguiente"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          <article class="rounded-3xl bg-white border border-gray-100 shadow-sm p-4 md:p-5">
            <p class="text-xs uppercase tracking-[0.16em] text-gray-400">Total mes</p>
            <p class="text-2xl md:text-3xl font-bold text-green-700 mt-2">${{ serieActiva.totalMes.toLocaleString('es-AR') }}</p>
          </article>
          <article class="rounded-3xl bg-white border border-gray-100 shadow-sm p-4 md:p-5">
            <p class="text-xs uppercase tracking-[0.16em] text-gray-400">Operaciones</p>
            <p class="text-2xl md:text-3xl font-bold text-gray-900 mt-2">{{ serieActiva.operaciones }}</p>
          </article>
          <article class="rounded-3xl bg-white border border-gray-100 shadow-sm p-4 md:p-5">
            <p class="text-xs uppercase tracking-[0.16em] text-gray-400">Promedio activo</p>
            <p class="text-2xl md:text-3xl font-bold text-gray-900 mt-2">${{ Math.round(serieActiva.promedioDiaActivo).toLocaleString('es-AR') }}</p>
          </article>
          <article class="rounded-3xl bg-white border border-gray-100 shadow-sm p-4 md:p-5">
            <p class="text-xs uppercase tracking-[0.16em] text-gray-400">Mejor dia</p>
            <p class="text-lg md:text-2xl font-bold text-gray-900 mt-2">{{ serieActiva.mejorDia.day || '—' }}</p>
            <p class="text-sm text-gray-500 mt-1">${{ (serieActiva.mejorDia.total ?? 0).toLocaleString('es-AR') }}</p>
          </article>
        </section>

        <section v-if="loading" class="rounded-3xl bg-white border border-gray-100 shadow-sm p-8 flex flex-col items-center gap-3 text-gray-500">
          <svg class="animate-spin h-7 w-7 text-green-500" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
          </svg>
          <p class="text-sm md:text-base">Cargando datos de {{ periodoLabel }}...</p>
        </section>

        <template v-else>
          <section v-if="serieActiva.operaciones === 0" class="rounded-3xl bg-white border border-dashed border-gray-200 shadow-sm p-8 text-center text-gray-400">
            <p class="text-lg font-semibold text-gray-500">Sin datos para este periodo</p>
            <p class="text-sm md:text-base mt-2">Probá cambiar de mes o alternar entre ventas y compras.</p>
          </section>

          <template v-else>
            <section class="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-4 md:gap-6">
              <article class="rounded-3xl bg-white border border-gray-100 shadow-sm p-4 md:p-6">
                <div class="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p class="text-xs uppercase tracking-[0.16em] text-gray-400">Grafico principal</p>
                    <h2 class="text-lg md:text-xl font-bold text-gray-900 mt-1">Monto diario</h2>
                  </div>
                  <div class="text-right">
                    <p class="text-xs text-gray-400">Pico mensual</p>
                    <p class="text-sm md:text-base font-semibold text-gray-900">${{ serieActiva.maxTotal.toLocaleString('es-AR') }}</p>
                  </div>
                </div>

                <div class="relative h-64 md:h-80 rounded-2xl bg-[linear-gradient(180deg,#f9fafb_0%,#ffffff_100%)] overflow-hidden border border-gray-100 px-3 py-4">
                  <div class="absolute inset-x-3 top-4 bottom-10 flex flex-col justify-between pointer-events-none">
                    <div class="border-t border-dashed border-gray-200"></div>
                    <div class="border-t border-dashed border-gray-200"></div>
                    <div class="border-t border-dashed border-gray-200"></div>
                  </div>

                  <div class="absolute inset-x-3 top-3 bottom-10 flex items-end gap-1.5 md:gap-2">
                    <div
                      v-for="point in serieActiva.puntos"
                      :key="point.day"
                      class="flex-1 h-full flex flex-col justify-end items-center min-w-0"
                    >
                      <div
                        class="w-full rounded-t-xl transition-all duration-300"
                        :class="point.total === serieActiva.mejorDia.total ? 'bg-green-500 shadow-[0_8px_18px_rgba(34,197,94,0.22)]' : 'bg-green-200'"
                        :style="{ height: `${point.altura}%` }"
                      ></div>
                    </div>
                  </div>

                  <div class="absolute inset-x-3 bottom-3 flex items-center gap-1.5 md:gap-2">
                    <div
                      v-for="point in serieActiva.puntos"
                      :key="`label-${point.day}`"
                      class="flex-1 text-center min-w-0"
                    >
                      <span v-if="point.showLabel" class="text-[10px] md:text-xs text-gray-400">{{ point.day }}</span>
                    </div>
                  </div>
                </div>
              </article>

              <article class="rounded-3xl bg-white border border-gray-100 shadow-sm p-4 md:p-6">
                <div class="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p class="text-xs uppercase tracking-[0.16em] text-gray-400">Ritmo diario</p>
                    <h2 class="text-lg md:text-xl font-bold text-gray-900 mt-1">Cantidad de operaciones</h2>
                  </div>
                  <div class="text-right">
                    <p class="text-xs text-gray-400">Ticket promedio</p>
                    <p class="text-sm md:text-base font-semibold text-gray-900">${{ Math.round(serieActiva.ticketPromedio).toLocaleString('es-AR') }}</p>
                  </div>
                </div>

                <div class="rounded-2xl border border-gray-100 bg-gray-50 p-3 md:p-4">
                  <svg :viewBox="`0 0 ${lineChart.width} ${lineChart.height}`" class="w-full h-48 md:h-56 overflow-visible">
                    <path :d="lineChart.area" fill="rgba(34,197,94,0.12)"></path>
                    <polyline
                      :points="lineChart.polyline"
                      fill="none"
                      stroke="#16a34a"
                      stroke-width="4"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <circle
                      v-for="point in lineChart.coords.filter(p => p.count > 0)"
                      :key="`dot-${point.day}`"
                      :cx="point.x"
                      :cy="point.y"
                      r="4.5"
                      fill="#16a34a"
                    />
                  </svg>
                </div>

                <div class="grid grid-cols-3 gap-3 mt-4 text-center">
                  <div class="rounded-2xl bg-green-50 px-3 py-3">
                    <p class="text-xs uppercase tracking-[0.12em] text-green-700">Max</p>
                    <p class="text-lg font-bold text-green-800 mt-1">{{ serieActiva.maxCount }}</p>
                  </div>
                  <div class="rounded-2xl bg-gray-50 px-3 py-3">
                    <p class="text-xs uppercase tracking-[0.12em] text-gray-500">Dias activos</p>
                    <p class="text-lg font-bold text-gray-900 mt-1">{{ serieActiva.diasConMovimiento }}</p>
                  </div>
                  <div class="rounded-2xl bg-gray-50 px-3 py-3">
                    <p class="text-xs uppercase tracking-[0.12em] text-gray-500">Tipo</p>
                    <p class="text-lg font-bold text-gray-900 mt-1 capitalize">{{ modo }}</p>
                  </div>
                </div>
              </article>
            </section>

            <section class="rounded-3xl bg-white border border-gray-100 shadow-sm p-4 md:p-6">
              <div class="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p class="text-xs uppercase tracking-[0.16em] text-gray-400">Top del mes</p>
                  <h2 class="text-lg md:text-xl font-bold text-gray-900 mt-1">Dias destacados</h2>
                </div>
                <p class="text-sm text-gray-400">Top 5 por monto</p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <article
                  v-for="dia in topDias"
                  :key="dia.day"
                  class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4"
                >
                  <p class="text-xs uppercase tracking-[0.14em] text-gray-400">Dia {{ dia.day }}</p>
                  <p class="text-xl font-bold text-gray-900 mt-2">${{ dia.total.toLocaleString('es-AR') }}</p>
                  <p class="text-sm text-gray-500 mt-1">{{ dia.count }} operaciones</p>
                </article>
              </div>
            </section>
          </template>
        </template>
      </div>
    </main>
  </div>
</template>