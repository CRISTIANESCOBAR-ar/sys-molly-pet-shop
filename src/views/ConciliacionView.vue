<script setup>
import { ref, computed, onMounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useVentasStore } from '@/stores/useVentasStore'
import Swal from 'sweetalert2'

const ventasStore = useVentasStore()

// State
const csvFile = ref(null)
const parsedRows = ref([])
const isDragging = ref(false)

// Cargar ventas locales (es realtime mediante subscribe)
onMounted(async () => {
  ventasStore.subscribe()
})

// Computed para obtener las ventas locales pagadas con métodos digitales
const ventasDigitales = computed(() => {
  return ventasStore.ventas.filter(v => 
    v.metodo_pago === 'transferencia' || 
    v.metodo_pago === 'Mercado Pago' || 
    v.metodo_pago === 'Transferencia' || 
    v.metodo_pago === 'QR' || 
    v.metodo_pago === 'Tarjeta'
  ).map(v => {
    // Buscar si hay coincidencia
    const match = findMatch(v)
    return {
      ...v,
      conciliado: !!match,
      matchDetalle: match
    }
  }).sort((a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0))
})

// Drag and drop handlers
function onDragOver(e) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave(e) {
  e.preventDefault()
  isDragging.value = false
}

function onDrop(e) {
  e.preventDefault()
  isDragging.value = false
  const files = e.dataTransfer.files
  if (files.length > 0) {
    handleFile(files[0])
  }
}

function onFileSelect(e) {
  const files = e.target.files
  if (files.length > 0) {
    handleFile(files[0])
  }
}

// Lógica de CSV parsing
function handleFile(file) {
  if (!file.name.endsWith('.csv')) {
    Swal.fire({
      icon: 'error',
      title: 'Archivo no válido',
      text: 'Por favor, selecciona un archivo CSV.',
      confirmButtonColor: '#10b981'
    })
    return
  }
  
  csvFile.value = file
  const reader = new FileReader()
  
  reader.onload = (e) => {
    const text = e.target.result
    parseCSV(text)
  }
  
  reader.readAsText(file)
}

function parseCSV(text) {
  const lines = text.split('\n').filter(line => line.trim() !== '')
  if (lines.length === 0) return
  
  const separator = lines[0].includes(';') ? ';' : ','
  
  const parseLine = (line) => {
    const regex = new RegExp(`(?:^|${separator})(\"(?:[^\"]+|\"\")*\"|[^${separator}]*)`, 'g')
    const result = []
    let match
    while (match = regex.exec(line)) {
      if (match.index === regex.lastIndex) regex.lastIndex++
      let val = match[1] || ''
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1).replace(/""/g, '"')
      }
      result.push(val.trim())
    }
    return result
  }

  const headers = parseLine(lines[0])
  const rows = []
  
  const idxAmount = headers.findIndex(h => h === 'TRANSACTION_AMOUNT' || h === 'transaction_amount')
  const idxDate = headers.findIndex(h => h === 'TRANSACTION_DATE' || h === 'date_created')
  const idxSource = headers.findIndex(h => h === 'SOURCE_ID' || h === 'operation_id')

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    if (values.length < headers.length * 0.5) continue // Ignorar sumarios
    
    const rowObj = {}
    headers.forEach((header, index) => {
      rowObj[header] = values[index] !== undefined ? values[index] : ''
    })
    
    const amountStr = rowObj['TRANSACTION_AMOUNT'] || rowObj['transaction_amount'] || values[idxAmount]
    const dateStr = rowObj['TRANSACTION_DATE'] || rowObj['date_created'] || values[idxDate]
    const sourceId = rowObj['SOURCE_ID'] || rowObj['operation_id'] || values[idxSource]
    
    const amount = parseFloat(String(amountStr).replace(',', '.')) || 0
    if (amount > 0 && dateStr) {
      rows.push({
        ...rowObj,
        SOURCE_ID: sourceId,
        _amountNum: amount,
        _dateObj: new Date(dateStr),
        usado: false
      })
    }
  }
  
  parsedRows.value = rows
  Swal.fire({
    icon: 'success',
    title: 'Reporte cargado',
    text: `CSV cargado: ${rows.length} cobros encontrados.`,
    confirmButtonColor: '#10b981',
    timer: 2000
  })
}

// Lógica de conciliación
function findMatch(ventaLocal) {
  if (parsedRows.value.length === 0) return null
  
  const montoLocal = ventaLocal.total || 0
  const refLocal = ventaLocal.referencia_pago ? ventaLocal.referencia_pago.slice(-4) : ''
  const dateLocal = ventaLocal.fecha?.toDate ? ventaLocal.fecha.toDate() : (ventaLocal.fecha ? new Date(ventaLocal.fecha) : new Date())
  
  // Buscar en filas CSV
  for (let row of parsedRows.value) {
    if (row.usado) continue
    
    // Si tenemos referencia (los 4 dígitos)
    const refCSV = row['SOURCE_ID'] ? row['SOURCE_ID'].slice(-4) : ''
    
    // Criterio 1: Referencia coincide exactamente y el monto es igual
    if (refLocal && refCSV === refLocal && Math.abs(row._amountNum - montoLocal) < 0.1) {
      row.usado = true
      return row
    }
    
    // Criterio 2: No hay referencia, pero el monto es exacto y la fecha es cercana (dentro de 10 min)
    if (!refLocal) {
      if (Math.abs(row._amountNum - montoLocal) < 0.1) {
        const diffMs = Math.abs(row._dateObj - dateLocal)
        const diffMin = diffMs / (1000 * 60)
        
        if (diffMin <= 10) {
          row.usado = true
          return row
        }
      }
    }
  }
  
  return null
}

const totalVentasDigitales = computed(() => {
  return ventasDigitales.value.reduce((acc, v) => acc + (v.total || 0), 0)
})

const totalConciliado = computed(() => {
  return ventasDigitales.value.filter(v => v.conciliado).reduce((acc, v) => acc + (v.total || 0), 0)
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">
    <NavBar />
    
    <div class="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-black tracking-tight text-slate-900">Conciliación de Pagos</h1>
          <p class="text-sm font-medium text-slate-500">Verifica tus ventas digitales contra los reportes de Mercado Pago</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        <!-- Panel Izquierdo: Ventas Locales -->
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h2 class="text-lg font-bold text-slate-800">Ventas Registradas</h2>
            <div class="text-right">
              <span class="text-sm font-semibold text-slate-500">Conciliado</span>
              <p class="text-lg font-black" :class="totalConciliado === totalVentasDigitales && totalVentasDigitales > 0 ? 'text-emerald-600' : 'text-amber-500'">
                ${{ totalConciliado.toFixed(2) }} <span class="text-sm font-medium text-slate-400">/ ${{ totalVentasDigitales.toFixed(2) }}</span>
              </p>
            </div>
          </div>
          
          <div class="flex-1 max-h-[600px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            <div v-if="ventasDigitales.length === 0" class="text-center py-10 text-slate-400 font-medium">
              No hay ventas digitales registradas hoy.
            </div>
            
            <div v-for="venta in ventasDigitales" :key="venta.id" 
                 class="p-3 rounded-xl border transition-all"
                 :class="venta.conciliado ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white hover:border-slate-300'">
              
              <div class="flex justify-between items-start">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-800">Venta #{{ venta.id.slice(-5).toUpperCase() }}</span>
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold"
                          :class="venta.conciliado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'">
                      {{ venta.conciliado ? 'CONCILIADO' : 'PENDIENTE' }}
                    </span>
                  </div>
                  <div class="text-xs font-medium text-slate-500 mt-1 flex items-center gap-2">
                    <span>{{ venta.metodo_pago }}</span>
                    <span v-if="venta.referencia_pago">&bull; Ref: {{ venta.referencia_pago }}</span>
                    <span>&bull; {{ venta.fecha?.toDate ? venta.fecha.toDate().toLocaleString('es-AR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : (venta.fecha ? new Date(venta.fecha).toLocaleString('es-AR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '') }}</span>
                  </div>
                </div>
                <div class="text-right">
                  <p class="font-black text-slate-900">${{ venta.total?.toFixed(2) }}</p>
                </div>
              </div>
              
              <div v-if="venta.conciliado" class="mt-3 pt-2 border-t border-emerald-100/50 flex items-center gap-2 text-xs text-emerald-600 font-medium">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>
                Coincide con SOURCE_ID: {{ venta.matchDetalle['SOURCE_ID'] }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Panel Derecho: CSV Upload y Datos -->
        <div class="flex flex-col gap-6">
          
          <!-- Dropzone -->
          <div 
            @dragover="onDragOver" 
            @dragleave="onDragLeave" 
            @drop="onDrop"
            class="bg-white rounded-2xl shadow-sm border-2 border-dashed transition-colors p-8 flex flex-col items-center justify-center text-center cursor-pointer border-slate-300 hover:border-slate-400 hover:bg-slate-50"
            :class="{'border-blue-500 bg-blue-50': isDragging}"
            @click="$refs.fileInput.click()"
          >
            <input type="file" ref="fileInput" accept=".csv" class="hidden" @change="onFileSelect" />
            <div class="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
            </div>
            <h3 class="text-lg font-bold text-slate-800">Cargar reporte de Mercado Pago</h3>
            <p class="text-sm font-medium text-slate-500 mt-1">Arrastra tu archivo CSV aquí o haz clic para seleccionar</p>
            <p v-if="csvFile" class="mt-4 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              Archivo: {{ csvFile.name }}
            </p>
          </div>
          
          <!-- Lista de Cobros CSV -->
          <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4 flex-1">
            <h2 class="text-lg font-bold text-slate-800">Cobros del Reporte ({{ parsedRows.length }})</h2>
            <div class="flex-1 max-h-[400px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              <div v-if="parsedRows.length === 0" class="text-center py-10 text-slate-400 font-medium">
                Sube un archivo para ver los cobros.
              </div>
              
              <div v-for="(row, idx) in parsedRows" :key="idx" 
                   class="p-2.5 rounded-lg border text-sm flex justify-between items-center transition-colors"
                   :class="row.usado ? 'border-emerald-200 bg-emerald-50/50 text-slate-500 opacity-60' : 'border-slate-200 bg-white'">
                
                <div>
                  <p class="font-bold text-slate-800" :class="{'line-through': row.usado}">ID: {{ row['SOURCE_ID'] }}</p>
                  <p class="text-xs font-medium text-slate-500 mt-0.5">
                    {{ new Date(row['TRANSACTION_DATE']).toLocaleString('es-AR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="font-black text-slate-900" :class="{'line-through': row.usado}">${{ row._amountNum.toFixed(2) }}</p>
                  <span v-if="row.usado" class="text-[10px] font-bold text-emerald-600">Emparejado</span>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
      
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 20px;
}
</style>
