<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useAuthStore } from '@/stores/useAuthStore'
import { useVentasStore } from '@/stores/useVentasStore'
import { useComprasStore } from '@/stores/useComprasStore'
import { useProductosStore } from '@/stores/useProductosStore'

const authStore = useAuthStore()
const ventasStore = useVentasStore()
const comprasStore = useComprasStore()
const productosStore = useProductosStore()

const hoy = new Date()
const periodo = ref({ year: hoy.getFullYear(), month: hoy.getMonth() + 1 })
const modo = ref('ventas')
const tab = ref('general')
const loading = ref(true)
const diaActivoTooltip = ref(null)

let unsubVentas
let unsubCompras
let unsubProductos

const periodoLabel = computed(() => {
  const d = new Date(periodo.value.year, periodo.value.month - 1, 1)
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
})

const esMesActual = computed(() =>
  periodo.value.year === hoy.getFullYear() && periodo.value.month === hoy.getMonth() + 1,
)

const modosDisponibles = computed(() => {
  const items = [{ value: 'ventas', label: 'Ventas', icon: '🛒', desc: 'Ver rentabilidad en base a ventas' }]
  if (authStore.isAdmin) items.push({ value: 'compras', label: 'Compras', icon: '🛍️', desc: 'Ver proyección en base a gastos a proveedores' })
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
    hours: Array.from({ length: 24 }, () => 0)
  }))

  for (const item of items) {
    const fecha = normalizarFecha(item.fecha)
    if (!fecha) continue
    const dia = fecha.getDate()
    if (dia < 1 || dia > diasEnMes) continue
    puntos[dia - 1].total += Number(item.total ?? 0)
    puntos[dia - 1].count += 1
    puntos[dia - 1].hours[fecha.getHours()] += 1
  }

  const maxTotal = Math.max(0, ...puntos.map(p => p.total))
  const maxCount = Math.max(0, ...puntos.map(p => p.count))
  const diasConMovimiento = puntos.filter(p => p.count > 0).length
  const totalMes = puntos.reduce((acc, p) => acc + p.total, 0)
  const operaciones = puntos.reduce((acc, p) => acc + p.count, 0)
  const mejorDia = [...puntos].sort((a, b) => b.total - a.total)[0] || { day: 0, total: 0, count: 0 }
  const pasoEtiquetas = diasEnMes > 25 ? 5 : diasEnMes > 14 ? 3 : 2
  const letrasDias = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
  const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  return {
    puntos: puntos.map((p, index) => {
      const date = new Date(periodo.value.year, periodo.value.month - 1, index + 1)
      return {
        ...p,
        weekLetter: letrasDias[date.getDay()],
        weekDayName: nombresDias[date.getDay()],
        altura: maxTotal ? Math.max((p.total / maxTotal) * 100, p.total > 0 ? 8 : 0) : 0,
        showLabel: index === 0 || index === diasEnMes - 1 || (index + 1) % pasoEtiquetas === 0,
      }
    }),
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

const rankingProductos = computed(() => {
  const map = new Map()
  
  // Usamos ventas para el ranking de productos ("lo que más se vende y más deja")
  const ventas = ventasStore.ventas.filter(v => v.estado !== 'anulada')

  for (const v of ventas) {
    const fecha = normalizarFecha(v.creado_en || v.fecha)
    if (!fecha) continue
    
    // 0 = Domingo, 6 = Sábado
    const esFinde = fecha.getDay() === 0 || fecha.getDay() === 6

    for (const item of (v.items || [])) {
      if (!map.has(item.id)) {
        // Buscar el producto en el store para obtener su costo real actual
        // Nota: Si el costo historico cambió, esto usará el costo actual. Para un margen 100% exacto 
        // historico deberíamos guardar el costo_unitario en el ticket de venta, pero esto sirve de aproximación.
        const bdProd = productosStore.productos.find(p => p.id === item.id)
        
        map.set(item.id, {
          id: item.id,
          nombre: item.nombre || bdProd?.nombre || 'Producto sin nombre',
          qty: 0,
          ingresos: 0,
          costoUnitario: Number(bdProd?.precio_compra) || 0,
          qtyFindes: 0
        })
      }
      
      const stat = map.get(item.id)
      const cant = Number(item.qty || 1)
      const sub = Number(item.subtotal || (item.precio_unitario * cant) || 0)
      
      stat.qty += cant
      stat.ingresos += sub
      if (esFinde) {
        stat.qtyFindes += cant
      }
    }
  }

  const arrayStats = Array.from(map.values()).map(p => {
    p.costoTotal = p.qty * p.costoUnitario
    p.gananciaNeta = p.ingresos - p.costoTotal
    p.margenPct = p.costoTotal > 0 ? (p.gananciaNeta / p.costoTotal) * 100 : 100 // Si no hay costo, ganancia full
    return p
  })

  return {
    masVendidos: [...arrayStats].sort((a, b) => b.qty - a.qty).slice(0, 10),
    masRentables: [...arrayStats].sort((a, b) => b.gananciaNeta - a.gananciaNeta).slice(0, 10),
    estrellasFinde: [...arrayStats].filter(p => p.qtyFindes > 0).sort((a, b) => b.qtyFindes - a.qtyFindes).slice(0, 10)
  }
})

const lineChart = computed(() => {
  const puntos = serieActiva.value.puntos
  const width = 640
  const height = 220
  const padX = 20
  const padY = 8
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
    stepX,
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

function generarTooltipHorarios(punto) {
  if (!punto || punto.count === 0) return '<div class="p-2 text-sm font-medium text-gray-500">Sin operaciones</div>'

  const startHour = 8 // Volver al rango solicitado (8 a 22)
  const endHour = 22
  const relevantHours = punto.hours.slice(startHour, endHour + 1)
  const maxH = Math.max(...relevantHours, 1)

  let barsHTML = ''
  for (let i = 0; i < relevantHours.length; i++) {
    const h = startHour + i
    const val = relevantHours[i]
    const hPct = val > 0 ? Math.max((val / maxH) * 100, 2) : 0
    
    // Rótulos del eje inferior: números consecutivos
    const showLabel = `<span class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-gray-400">${h}</span>`
      
    // Cantidad encima del gráfico para columnas con datos
    const valLabel = val > 0 
      ? `<span class="absolute text-[8px] md:text-[9px] text-gray-600 font-bold mb-[2px] leading-none bottom-full left-1/2 -translate-x-1/2 min-w-max transition-transform group-hover:-translate-y-1 group-hover:text-gray-900">${val}</span>`
      : ''

    barsHTML += `
      <div class="flex-1 h-full group relative flex flex-col justify-end min-w-[8px]">
        <div class="w-full bg-teal-600/90 rounded-t-[2px] transition-colors group-hover:bg-teal-500 relative" style="height: ${hPct}%; min-height: ${val>0?'2px':'0'}">
          ${valLabel}
        </div>
        ${showLabel}
      </div>
    `
  }

  return `
    <div class="p-2 md:p-3 w-72 md:w-80">
      <div class="flex justify-between items-center mb-1">
        <button onclick="document.dispatchEvent(new CustomEvent('nav-grafico', {detail: ${punto.day - 1}}))" class="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors">
           <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <div class="text-center">
            <h4 class="text-sm font-bold text-gray-800">Horarios de concurrencia</h4>
            <span class="text-xs font-semibold text-gray-500">${punto.weekDayName} ${punto.day}</span>
        </div>
        <button onclick="document.dispatchEvent(new CustomEvent('nav-grafico', {detail: ${punto.day + 1}}))" class="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors">
           <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"></path></svg>
        </button>
      </div>
      <div class="flex items-center justify-between mb-3">
        <div class="text-xs text-green-700 font-bold flex items-center bg-green-50 px-2 py-1 rounded w-fit gap-2">
          <span>Total del día</span>
          <span class="bg-green-600 text-white rounded px-1.5 py-0.5">${punto.count} op</span>
        </div>
        <span class="font-black text-[13px] text-gray-800">$${punto.total.toLocaleString('es-AR')}</span>
      </div>
      <div class="relative h-28 w-full flex items-end gap-[1px] border-b border-gray-200 pb-1 mb-3 pt-6">
        <div class="absolute inset-x-0 top-0 border-t border-dashed border-gray-200 mt-6"></div>
        <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-gray-100 mt-3"></div>
        ${barsHTML}
      </div>
    </div>
  `
}

watch(periodo, resuscribir, { deep: true })
watch(() => authStore.isAdmin, esAdmin => {
  if (!esAdmin && modo.value === 'compras') modo.value = 'ventas'
})

function navegarTooltip(dir) {
  if (diaActivoTooltip.value === null) return
  const nextDay = diaActivoTooltip.value + dir
  const currentEl = document.getElementById(`dia-grafico-${diaActivoTooltip.value}`)
  const nextEl = document.getElementById(`dia-grafico-${nextDay}`)
  
  if (nextEl && nextEl._tippy) {
    if (currentEl && currentEl._tippy) {
      currentEl._tippy.hide()
    }
    nextEl._tippy.show()
  }
}

function handleKeydown(e) {
  if (diaActivoTooltip.value === null) return
  if (e.key === 'ArrowLeft') navegarTooltip(-1)
  if (e.key === 'ArrowRight') navegarTooltip(1)
}

function handleNavGrafico(e) {
  const dir = e.detail - diaActivoTooltip.value
  navegarTooltip(dir)
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('nav-grafico', handleNavGrafico)
  unsubProductos = productosStore.subscribe?.() || (() => {})
  resuscribir()
})

const tooltipMonto = `
<div class="text-left text-gray-800 p-1 w-64 md:w-72 font-sans font-medium">
  <h3 class="text-[14px] md:text-[15px] font-bold text-teal-800 border-b-[2px] border-teal-600 pb-1.5 mb-2 leading-tight">MONTO DIARIO</h3>
  <p class="text-[11px] md:text-[12px] text-gray-600 mb-3 leading-snug">Representa el resumen financiero del valor transaccionado, combinando y acumulando los ingresos de cada día.</p>
  
  <div class="rounded-md bg-teal-50 border-l-[3px] border-teal-500 py-1.5 px-2.5 mb-2">
    <p class="text-[11px] md:text-[12px] text-teal-900 font-bold flex items-center gap-1"><span class="text-teal-600">✓</span> Picos óptimos</p>
    <span class="text-[10px] md:text-[11px] text-teal-800 leading-none mt-1 block">Días donde la recaudación supera significativamente el promedio.</span>
  </div>
  
  <div class="rounded-md bg-amber-50 border-l-[3px] border-amber-400 py-1.5 px-2.5 mb-2 flex flex-col justify-center">
    <p class="text-[11px] md:text-[12px] text-amber-900 font-bold flex items-center gap-1"><span class="text-amber-500">⚠</span> Fines de semana (S y D)</p>
    <span class="text-[10px] md:text-[11px] text-amber-800 leading-none mt-1 block">Tienen una base destacada para detectar en qué magnitud afectan las compras por descanso.</span>
  </div>
  
  <div class="rounded-md bg-rose-50 border-l-[3px] border-rose-400 py-1.5 px-2.5">
    <p class="text-[11px] md:text-[12px] text-rose-900 font-bold flex items-center gap-1"><span class="text-rose-500">✗</span> Valles / Días nulos</p>
    <span class="text-[10px] md:text-[11px] text-rose-800 leading-none mt-1 block">Barras vacías. Ayuda a identificar falta de stock, ausencia de clientes o feriados limitantes.</span>
  </div>
</div>
`

const tooltipRitmo = `
<div class="text-left text-gray-800 p-1 w-64 md:w-72 font-sans font-medium">
  <h3 class="text-[14px] md:text-[15px] font-bold text-blue-800 border-b-[2px] border-blue-600 pb-1.5 mb-2 leading-tight">RITMO DIARIO</h3>
  <p class="text-[11px] md:text-[12px] text-gray-600 mb-3 leading-snug">Contabiliza cuántos tickets individuales se emitieron, sin importar la cantidad de dinero involucrada en ellos.</p>
  
  <div class="rounded-md bg-blue-50 border-l-[3px] border-blue-500 py-1.5 px-2.5 mb-2">
    <p class="text-[11px] md:text-[12px] text-blue-900 font-bold flex items-center gap-1"><span class="text-blue-600">✓</span> Alto flujo de atención</p>
    <span class="text-[10px] md:text-[11px] text-blue-800 leading-none mt-1 block">Numerosos tickets. Demandó un mayor esfuerzo operativo en mostrador.</span>
  </div>

  <div class="rounded-md bg-amber-50 border-l-[3px] border-amber-400 py-1.5 px-2.5 mb-2">
    <p class="text-[11px] md:text-[12px] text-amber-900 font-bold flex items-center gap-1"><span class="text-amber-500">⚠</span> Contraste con el Monto</p>
    <span class="text-[10px] md:text-[11px] text-amber-800 leading-none mt-1 block">Pocas operaciones pero barra alta en el gráfico izquierdo revela una compra excepcionalmente grande.</span>
  </div>
  
  <div class="rounded-md bg-indigo-50 border-l-[3px] border-indigo-400 py-1.5 px-2.5">
    <p class="text-[11px] md:text-[12px] text-indigo-900 font-bold flex items-center gap-1"><span class="text-indigo-500">ℹ</span> Días Activos</p>
    <span class="text-[10px] md:text-[11px] text-indigo-800 leading-none mt-1 block">Te dice la consistencia o regularidad de visitas que sostienen el negocio diariamente.</span>
  </div>
</div>
`

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('nav-grafico', handleNavGrafico)
  unsubVentas?.()
  unsubCompras?.()
  unsubProductos?.()
})
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-50">
    <NavBar />

    <main class="flex-1 min-h-0 overflow-y-auto">
      <div class="w-full max-w-[1600px] mx-auto relative px-2 md:px-4">
        
        <!-- Desktop Sticky / Mobile Normal -->
        <div class="md:sticky md:top-0 md:z-20 bg-gray-50 pt-1 md:pt-4 pb-1 md:pb-3">
          <section class="rounded-2xl bg-white border border-gray-200 shadow-md p-2.5 md:p-4 mb-2 md:mb-0">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between flex-wrap gap-3 lg:gap-4">
              
              <!-- Izquierda: Titulo y Botones -->
              <div class="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-4 flex-shrink-0">
                <div class="flex items-center md:items-start gap-1.5 md:gap-0 md:flex-col shrink-0">
                  <p class="text-[10px] md:text-xs font-bold md:font-semibold uppercase tracking-[0.18em] text-green-600 leading-none">Analítica diaria</p>
                  <span class="md:hidden text-gray-300">|</span>
                  <h1 class="text-[15px] md:text-xl font-bold text-gray-900 leading-none md:mt-1">Estadísticas del mes</h1>
                </div>

                <!-- Contenedor unificado para Tabs y Modos en una sola fila -->
                <div class="flex items-center gap-1 rounded-xl bg-gray-100 p-1 w-full md:w-auto">
                  <button
                    @click="tab = 'general'"
                    :class="[
                      'flex-1 px-1 py-1.5 rounded-lg text-[11px] sm:text-sm font-bold transition-colors flex items-center justify-center gap-1',
                      tab === 'general' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                    ]"
                  >
                    <span>📊</span><span class="truncate">General</span>
                  </button>
                  <button
                    @click="tab = 'productos'"
                    :class="[
                      'flex-1 px-1 py-1.5 rounded-lg text-[11px] sm:text-sm font-bold transition-colors flex items-center justify-center gap-1',
                      tab === 'productos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                    ]"
                  >
                    <span>🏆</span><span class="truncate">Productos</span>
                  </button>

                  <div v-show="tab === 'general'" class="w-[1px] h-4 bg-gray-300 mx-0.5"></div>

                  <button
                    v-show="tab === 'general'"
                    v-for="item in modosDisponibles"
                    :key="item.value"
                    @click="modo = item.value"
                    :class="[
                      'flex-1 px-1 py-1.5 rounded-lg text-[11px] sm:text-sm font-semibold transition-colors flex items-center justify-center gap-1',
                      modo === item.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                    ]"
                  >
                    <span>{{ item.icon }}</span><span class="truncate">{{ item.label }}</span>
                  </button>
                </div>
              </div>

              <!-- Centro: Stats (Kpis) en linea -->
              <div class="grid grid-cols-2 md:flex md:flex-wrap md:items-center justify-center gap-1.5 md:gap-3 flex-1 mt-1 lg:mt-0 min-w-0">
                <div class="bg-gray-50 md:bg-transparent px-2 py-1 md:p-0 rounded-md md:rounded-none flex items-baseline justify-between md:block min-w-0">
                  <p class="text-[9px] md:text-[10px] uppercase tracking-[0.16em] text-gray-400 truncate">Total mes</p>
                  <p class="text-[13px] md:text-[15px] font-bold text-green-700 mt-0 md:mt-0.5 truncate">${{ serieActiva.totalMes.toLocaleString('es-AR') }}</p>
                </div>
                <div class="bg-gray-50 md:bg-transparent px-2 py-1 md:p-0 rounded-md md:rounded-none flex items-baseline justify-between md:block md:border-l border-gray-100 md:pl-3 min-w-0">
                  <p class="text-[9px] md:text-[10px] uppercase tracking-[0.16em] text-gray-400 truncate">Operaciones</p>
                  <p class="text-[13px] md:text-[15px] font-bold text-gray-900 mt-0 md:mt-0.5 truncate">{{ serieActiva.operaciones }}</p>
                </div>
                <div class="bg-gray-50 md:bg-transparent px-2 py-1 md:p-0 rounded-md md:rounded-none flex items-baseline justify-between md:block md:border-l border-gray-100 md:pl-3 min-w-0">
                  <p class="text-[9px] md:text-[10px] uppercase tracking-[0.16em] text-gray-400 truncate mr-1">Prom. activo</p>
                  <p class="text-[13px] md:text-[15px] font-bold text-gray-900 mt-0 md:mt-0.5 truncate">${{ Math.round(serieActiva.promedioDiaActivo).toLocaleString('es-AR') }}</p>
                </div>
                <div class="bg-gray-50 md:bg-transparent px-2 py-1 md:p-0 rounded-md md:rounded-none flex items-baseline justify-between md:block md:border-l border-gray-100 md:pl-3 lg:border-r lg:pr-3 min-w-0">
                  <p class="text-[9px] md:text-[10px] uppercase tracking-[0.16em] text-gray-400 truncate mr-1">Mejor dia ({{ serieActiva.mejorDia.day || '—' }})</p>
                  <p class="text-[13px] md:text-[15px] font-bold text-gray-900 mt-0 md:mt-0.5 truncate">${{ (serieActiva.mejorDia.total ?? 0).toLocaleString('es-AR') }}</p>
                </div>
              </div>

              <!-- Derecha: Paginador de mes (Visible Desktop) -->
              <div class="hidden md:flex items-center justify-between gap-2 rounded-xl bg-gray-50 border border-gray-100 px-2 py-1.5 min-w-[200px] flex-shrink-0 mt-1 lg:mt-0">
                <button
                  @click="anteriorMes"
                  v-tippy="'Mes anterior'"
                  class="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
                  aria-label="Mes anterior"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
                  </svg>
                </button>

                <div class="text-center min-w-0 flex-1 px-2">
                  <p class="text-sm md:text-base font-bold text-gray-900 capitalize truncate">{{ periodoLabel }}</p>
                </div>

                <button
                  @click="siguienteMes"
                  :disabled="esMesActual"
                  v-tippy="'Mes siguiente'"
                  class="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-30"
                  aria-label="Mes siguiente"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
            </div>
          </section>
        </div>

        <!-- Sticky Paginador Mobile -->
        <div class="md:hidden sticky top-0 z-20 bg-gray-50 pb-2">
          <div class="flex items-center justify-between gap-2 rounded-xl bg-white border border-gray-200 shadow-md px-3 py-2">
            <button @click="anteriorMes" class="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-50 border border-gray-200 text-gray-700 active:bg-gray-200 transition-colors" aria-label="Mes anterior">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div class="text-center min-w-0 flex-1 px-2">
              <p class="text-[15px] font-black text-gray-900 capitalize truncate leading-none">{{ periodoLabel }}</p>
            </div>
            <button @click="siguienteMes" :disabled="esMesActual" class="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-50 border border-gray-200 text-gray-700 active:bg-gray-200 transition-colors disabled:opacity-30" aria-label="Mes siguiente">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>

        <div class="space-y-3 pb-3 md:space-y-4 md:pb-4">
        <section v-if="loading" class="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-2 text-gray-500">
          <svg class="animate-spin h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
          </svg>
          <p class="text-sm">Cargando datos de {{ periodoLabel }}...</p>
        </section>

        <template v-else>
          <section v-if="serieActiva.operaciones === 0" class="rounded-2xl bg-white border border-dashed border-gray-200 shadow-sm p-6 text-center text-gray-400">
            <p class="text-base font-semibold text-gray-500">Sin datos para este periodo</p>
            <p class="text-xs md:text-sm mt-1">Probá cambiar de mes o alternar entre ventas y compras.</p>
          </section>

          <template v-else>
            <!-- TAB GENERAL -->
            <div v-if="tab === 'general'" class="space-y-3 md:space-y-4">
              <section class="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-3 md:gap-4">
              <article class="flex flex-col rounded-2xl bg-white border border-gray-100 shadow-sm p-3 md:p-4">
                <div class="flex items-start justify-between gap-3 mb-2 flex-shrink-0">
                  <div>
                    <p class="text-[10px] md:text-xs uppercase tracking-[0.16em] text-gray-400">Grafico principal</p>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <h2 class="text-base md:text-lg font-bold text-gray-900 leading-none">Monto diario</h2>
                      <div v-tippy="{ content: tooltipMonto, allowHTML: true, placement: 'right', theme: 'light-border', maxWidth: 350 }" class="text-gray-400 hover:text-teal-500 cursor-pointer transition-colors">
                        <svg class="w-4 h-4 md:w-4 md:h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-[10px] text-gray-400">Pico mensual</p>
                    <p class="text-sm font-semibold text-gray-900">${{ serieActiva.maxTotal.toLocaleString('es-AR') }}</p>
                  </div>
                </div>

                <div class="flex-1 relative min-h-[300px] h-[55vh] md:h-[calc(100vh-280px)] rounded-xl bg-[linear-gradient(180deg,#f9fafb_0%,#ffffff_100%)] overflow-hidden border border-gray-100 px-2 py-3 mt-auto">
                  <div class="absolute inset-x-2 top-3 bottom-7 md:bottom-8 flex flex-col justify-between pointer-events-none">
                    <div class="border-t border-dashed border-gray-200"></div>
                    <div class="border-t border-dashed border-gray-200"></div>
                    <div class="border-t border-dashed border-gray-200"></div>
                    <div class="border-t border-solid border-gray-200"></div>
                  </div>

                  <div class="absolute inset-x-2 top-3 bottom-7 md:bottom-8 flex items-end gap-[2px] md:gap-1 px-1">
                    <div
                      v-for="point in serieActiva.puntos"
                      :key="point.day"
                      v-tippy="`${point.weekDayName} ${point.day}: $${point.total.toLocaleString('es-AR')} (${point.count} op)`"
                      class="flex-1 h-full flex flex-col justify-end items-center min-w-0"
                    >
                      <div
                        class="w-full max-w-[20px] rounded-t-sm transition-all duration-300 hover:bg-green-400 cursor-pointer"
                        :class="point.total === serieActiva.mejorDia.total ? 'bg-green-500 shadow-[0_8px_18px_rgba(34,197,94,0.3)]' : 'bg-green-200/80'"
                        :style="{ height: `${point.altura}%`, minHeight: point.total > 0 ? '4px' : '0' }"
                      ></div>
                    </div>
                  </div>

                  <div class="absolute inset-x-2 bottom-1.5 md:bottom-2 flex items-end gap-[2px] md:gap-1 px-1 text-center">
                    <div
                      v-for="point in serieActiva.puntos"
                      :key="`label-${point.day}`"
                      :id="`dia-grafico-${point.day}`"
                      class="flex-1 flex flex-col items-center justify-end text-center min-w-0 cursor-help"
                      v-tippy="{ 
                        content: generarTooltipHorarios(point), 
                        allowHTML: true, 
                        placement: 'top', 
                        theme: 'light-border', 
                        interactive: true, 
                        interactiveBorder: 5, 
                        delay: [50, 0], 
                        duration: [150, 0], 
                        maxWidth: 'none', 
                        offset: [0, 8],
                        onShow: () => { diaActivoTooltip = point.day },
                        onHide: () => { if (diaActivoTooltip === point.day) diaActivoTooltip = null }
                      }"
                    >
                      <span
                        class="text-[8px] md:text-[9px] font-bold leading-none mb-0.5"
                        :class="['D', 'S'].includes(point.weekLetter) ? 'text-gray-500' : 'text-gray-300'"
                      >{{ point.weekLetter }}</span>
                      <span class="text-[8px] md:text-[10px] text-gray-400 leading-none font-medium hover:text-gray-600 transition-colors">{{ point.day }}</span>
                    </div>
                  </div>
                </div>
              </article>

              <article class="flex flex-col rounded-2xl bg-white border border-gray-100 shadow-sm p-3 md:p-4">
                <div class="flex items-start justify-between gap-3 mb-2 flex-shrink-0">
                  <div>
                    <p class="text-[10px] md:text-xs uppercase tracking-[0.16em] text-gray-400">Ritmo diario</p>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <h2 class="text-base md:text-lg font-bold text-gray-900 leading-none">Cantidad de operaciones</h2>
                      <div v-tippy="{ content: tooltipRitmo, allowHTML: true, placement: 'left', theme: 'light-border', maxWidth: 350 }" class="text-gray-400 hover:text-blue-500 cursor-pointer transition-colors">
                        <svg class="w-4 h-4 md:w-4 md:h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-[10px] text-gray-400">Ticket promedio</p>
                    <p class="text-sm font-semibold text-gray-900">${{ Math.round(serieActiva.ticketPromedio).toLocaleString('es-AR') }}</p>
                  </div>
                </div>

                <div class="flex-1 min-h-[200px] flex items-end rounded-2xl border border-gray-100 bg-gray-50 pt-3 md:pt-4 px-3 md:px-4 mt-auto overflow-hidden">
                  <svg :viewBox="`0 0 ${lineChart.width} ${lineChart.height}`" class="w-full h-full min-h-[150px] overflow-visible">
                    <path :d="lineChart.area" fill="rgba(34,197,94,0.12)"></path>
                    <polyline
                      :points="lineChart.polyline"
                      fill="none"
                      stroke="#16a34a"
                      stroke-width="4"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <g
                      v-for="point in lineChart.coords.filter(p => p.count > 0)"
                      :key="`dot-${point.day}`"
                      class="group outline-none"
                      v-tippy="`${point.weekDayName} ${point.day}: ${point.count} operaciones`"
                    >
                      <!-- Banda vertical invisible para capturar el hover en toda la vertical -->
                      <rect
                        :x="point.x - (lineChart.stepX ? lineChart.stepX / 2 : 15)"
                        y="0"
                        :width="lineChart.stepX || 30"
                        :height="lineChart.height"
                        fill="transparent"
                        class="outline-none"
                      />
                      <!-- Punto visible (pointer-events-none para que el rect tome el hover, y sin cursor-pointer) -->
                      <circle
                        :cx="point.x"
                        :cy="point.y"
                        r="4"
                        fill="#16a34a"
                        class="transition-all group-hover:fill-green-600 pointer-events-none"
                        style="transform-origin: center; transition: r 0.2s;"
                      />
                      <!-- Círculo ampliado oculto que aparece en hover para dar el efecto de crecer -->
                      <circle
                        :cx="point.x"
                        :cy="point.y"
                        r="6"
                        fill="#16a34a"
                        class="opacity-0 transition-opacity duration-200 group-hover:opacity-30 pointer-events-none"
                      />
                    </g>
                  </svg>
                </div>

                <div class="grid grid-cols-3 gap-2 mt-3 text-center flex-shrink-0">
                  <div class="rounded-xl bg-green-50 px-2 py-2">
                    <p class="text-[10px] md:text-xs uppercase tracking-[0.12em] text-green-700 leading-none mb-1">Max</p>
                    <p class="text-sm md:text-base font-bold text-green-800 leading-none">{{ serieActiva.maxCount }}</p>
                  </div>
                  <div class="rounded-xl bg-gray-50 px-2 py-2">
                    <p class="text-[10px] md:text-xs uppercase tracking-[0.12em] text-gray-500 leading-none mb-1">Dias activos</p>
                    <p class="text-sm md:text-base font-bold text-gray-900 leading-none">{{ serieActiva.diasConMovimiento }}</p>
                  </div>
                  <div class="rounded-xl bg-gray-50 px-2 py-2">
                    <p class="text-[10px] md:text-xs uppercase tracking-[0.12em] text-gray-500 leading-none mb-1">Tipo</p>
                    <p class="text-sm md:text-base font-bold text-gray-900 leading-none capitalize">{{ modo }}</p>
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
                  <p class="text-xs capitalize tracking-wide text-gray-500">Día {{ dia.weekDayName }} {{ dia.day }}</p>
                  <p class="text-xl font-bold text-gray-900 mt-2">${{ dia.total.toLocaleString('es-AR') }}</p>
                  <p class="text-sm text-gray-500 mt-1">{{ dia.count }} operaciones</p>
                </article>
              </div>
            </section>
            </div>

            <!-- TAB PRODUCTOS -->
            <div v-else-if="tab === 'productos'" class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              <!-- Más Vendidos -->
              <section class="rounded-2xl border border-gray-100 shadow-sm bg-white p-4">
                <div class="mb-4">
                  <p class="text-[10px] md:text-xs font-semibold uppercase tracking-[0.16em] text-green-600">Top 10 Mensual</p>
                  <h3 class="text-base md:text-lg font-bold text-gray-900 border-b pb-2 mb-2">Más vendidos (Unidades)</h3>
                </div>
                <div v-if="rankingProductos.masVendidos.length === 0" class="text-xs text-gray-400 italic">Sin datos</div>
                <ul class="space-y-2">
                  <li v-for="(prod, i) in rankingProductos.masVendidos" :key="prod.id" class="flex items-center gap-3">
                    <span class="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-green-100 text-green-800 text-xs font-bold">{{ i + 1 }}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-gray-800 truncate">{{ prod.nombre }}</p>
                    </div>
                    <span class="flex-shrink-0 text-sm font-bold text-gray-900 text-right">{{ prod.qty }}</span>
                  </li>
                </ul>
              </section>

              <!-- Mayor Ganancia -->
              <section class="rounded-2xl border border-gray-100 shadow-sm bg-white p-4">
                <div class="mb-4">
                  <p class="text-[10px] md:text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Top 10 Rentabilidad</p>
                  <h3 class="text-base md:text-lg font-bold text-gray-900 border-b pb-2 mb-2">Más ganancia neta</h3>
                </div>
                <div v-if="rankingProductos.masRentables.length === 0" class="text-xs text-gray-400 italic">Sin datos</div>
                <ul class="space-y-2">
                  <li v-for="(prod, i) in rankingProductos.masRentables" :key="prod.id" class="flex items-center gap-3">
                    <span class="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-blue-100 text-blue-800 text-xs font-bold">{{ i + 1 }}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-gray-800 truncate">{{ prod.nombre }}</p>
                      <p class="text-[10px] text-gray-500 truncate" v-if="prod.margenPct < 100">Margen: {{ Math.round(prod.margenPct) }}%</p>
                    </div>
                    <span class="flex-shrink-0 text-sm font-bold text-gray-900 text-right text-blue-600">${{ Math.round(prod.gananciaNeta).toLocaleString('es-AR') }}</span>
                  </li>
                </ul>
              </section>

              <!-- Estrellas Fin de semana -->
              <section class="rounded-2xl border border-gray-100 shadow-sm bg-white p-4">
                <div class="mb-4">
                  <p class="text-[10px] md:text-xs font-semibold uppercase tracking-[0.16em] text-amber-600">Top 10 Sáb y Dom</p>
                  <h3 class="text-base md:text-lg font-bold text-gray-900 border-b pb-2 mb-2">Estrellas del fin de semana</h3>
                </div>
                <div v-if="rankingProductos.estrellasFinde.length === 0" class="text-xs text-gray-400 italic">Sin datos</div>
                <ul class="space-y-2">
                  <li v-for="(prod, i) in rankingProductos.estrellasFinde" :key="prod.id" class="flex items-center gap-3">
                    <span class="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-amber-100 text-amber-800 text-xs font-bold">{{ i + 1 }}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-gray-800 truncate">{{ prod.nombre }}</p>
                    </div>
                    <span class="flex-shrink-0 text-sm font-bold text-gray-900 text-right">{{ prod.qtyFindes }}</span>
                  </li>
                </ul>
              </section>
            </div>
          </template>
        </template>
      </div>
      </div>
    </main>
  </div>
</template>