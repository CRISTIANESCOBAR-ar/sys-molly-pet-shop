import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const STORAGE_KEY      = 'molly_sync_queue'
const MAX_RETRIES      = 5
const RETRY_INTERVAL   = 3 * 60 * 1000   // 3 minutos

function loadFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Determina si un error de Firestore es transitorio (quota / sin conexión).
 * En esos casos la operación puede reintentarse más tarde.
 */
export function esErrorRecuperable(e) {
  const msg  = (e?.message || '').toLowerCase()
  const code = (e?.code    || '').toLowerCase()
  // Considerar como recuperables también errores de red/conn que pueden aparecer
  // en distintos navegadores o versiones de Firebase (ej: 'Failed to fetch', 'net::ERR_FAILED',
  // 'message port closed', 'closed before a response'). Esto permite guardar en cola
  // operaciones y reintentarlas cuando la conectividad vuelva estable.
  return (
    msg.includes('quota')  ||
    msg.includes('resource') ||
    code.includes('resource-exhausted') ||
    msg.includes('offline') ||
    code.includes('unavailable') ||
    !navigator.onLine ||
    msg.includes('failed to fetch') ||
    msg.includes('failed to load') ||
    msg.includes('err_failed') ||
    msg.includes('net::err') ||
    msg.includes('network') ||
    msg.includes('connection') ||
    msg.includes('closed before a response') ||
    msg.includes('message port closed') ||
    code.includes('aborted') ||
    code.includes('deadline-exceeded') ||
    code.includes('internal')
  )
}

export const useSyncQueueStore = defineStore('syncQueue', () => {
  const queue     = ref(loadFromStorage())
  const isSyncing = ref(false)

  // ─── Computed ──────────────────────────────────────────────────────────────
  const pendingCount = computed(() =>
    queue.value.filter(i => i.status !== 'error').length,
  )

  const hasErrors = computed(() =>
    queue.value.some(i => i.status === 'error'),
  )

  // ─── Persistencia automática ──────────────────────────────────────────────
  watch(queue, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  }, { deep: true })

  // ─── Mutaciones ───────────────────────────────────────────────────────────
  function addVenta(payload) {
    queue.value.push({
      id:        generateId(),
      type:      'registrarVenta',
      payload,
      createdAt: Date.now(),
      retries:   0,
      status:    'pending',
    })
  }

  function addCompra(payload) {
    queue.value.push({
      id:        generateId(),
      type:      'registrarCompra',
      payload,
      createdAt: Date.now(),
      retries:   0,
      status:    'pending',
    })
  }

  function removeItem(id) {
    const idx = queue.value.findIndex(i => i.id === id)
    if (idx !== -1) queue.value.splice(idx, 1)
  }

  function clearErrors() {
    queue.value = queue.value.filter(i => i.status !== 'error')
  }

  // ─── Procesamiento ────────────────────────────────────────────────────────
  async function processQueue() {
    if (isSyncing.value || !navigator.onLine) return

    const pending = queue.value.filter(
      i => i.status === 'pending' || i.status === 'retrying',
    )
    if (pending.length === 0) return

    isSyncing.value = true
    try {
      // Import dinámico para evitar dependencias circulares al cargar el módulo
      const [{ useVentasStore }, { useComprasStore }] = await Promise.all([
        import('./useVentasStore'),
        import('./useComprasStore'),
      ])
      const ventasStore  = useVentasStore()
      const comprasStore = useComprasStore()

      for (const item of [...pending]) {
        try {
          if (item.type === 'registrarVenta') {
            await ventasStore.registrarVentaDesdePayload(item.payload)
          } else if (item.type === 'registrarCompra') {
            await comprasStore.registrarCompra(item.payload)
          }
          removeItem(item.id)
        } catch (e) {
          const itemRef = queue.value.find(i => i.id === item.id)
          if (!itemRef) continue

          itemRef.retries++
          if (!esErrorRecuperable(e) || itemRef.retries >= MAX_RETRIES) {
            itemRef.status = 'error'
          } else {
            itemRef.status = 'retrying'
          }

          // Si sigue siendo error de quota, detener para no desperdiciar más cuota
          const code = (e?.code    || '').toLowerCase()
          const msg  = (e?.message || '').toLowerCase()
          if (msg.includes('quota') || code.includes('resource-exhausted')) break
        }
      }
    } finally {
      isSyncing.value = false
    }
  }

  // ─── Inicialización (llamar una vez al montar la app) ─────────────────────
  function init() {
    // Reintentar al recuperar conexión
    window.addEventListener('online', () => {
      setTimeout(processQueue, 1500)
    })

    // Intentar al inicio si hay pendientes
    if (navigator.onLine && pendingCount.value > 0) {
      setTimeout(processQueue, 2500)
    }

    // Reintento periódico
    setInterval(() => {
      if (navigator.onLine && pendingCount.value > 0) {
        processQueue()
      }
    }, RETRY_INTERVAL)
  }

  return {
    queue,
    isSyncing,
    pendingCount,
    hasErrors,
    addVenta,
    addCompra,
    removeItem,
    clearErrors,
    processQueue,
    init,
  }
})
