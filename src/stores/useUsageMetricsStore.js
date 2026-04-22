import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'molly_usage_metrics_session'

function nowIso() {
  return new Date().toISOString()
}

function loadSessionState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export const useUsageMetricsStore = defineStore('usageMetrics', () => {
  const initial = loadSessionState()

  const sessionStartedAt = ref(initial?.sessionStartedAt || nowIso())
  const estimatedReads = ref(Number(initial?.estimatedReads || 0))
  const estimatedWrites = ref(Number(initial?.estimatedWrites || 0))
  const listenerStarts = ref(Number(initial?.listenerStarts || 0))
  const listenerStops = ref(Number(initial?.listenerStops || 0))
  const bySource = ref(initial?.bySource || {})

  const activeListeners = computed(() => Math.max(0, listenerStarts.value - listenerStops.value))

  function persist() {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessionStartedAt: sessionStartedAt.value,
      estimatedReads: estimatedReads.value,
      estimatedWrites: estimatedWrites.value,
      listenerStarts: listenerStarts.value,
      listenerStops: listenerStops.value,
      bySource: bySource.value,
    }))
  }

  function ensureSource(source) {
    if (!bySource.value[source]) {
      bySource.value[source] = { reads: 0, writes: 0, listenerStarts: 0, listenerStops: 0, updatedAt: nowIso() }
    }
    return bySource.value[source]
  }

  function trackReadEstimate(source, count = 1) {
    const qty = Math.max(0, Number(count) || 0)
    if (!qty) return
    estimatedReads.value += qty
    const bucket = ensureSource(source)
    bucket.reads += qty
    bucket.updatedAt = nowIso()
    persist()
  }

  function trackWriteEstimate(source, count = 1) {
    const qty = Math.max(0, Number(count) || 0)
    if (!qty) return
    estimatedWrites.value += qty
    const bucket = ensureSource(source)
    bucket.writes += qty
    bucket.updatedAt = nowIso()
    persist()
  }

  function trackListenerStart(source) {
    listenerStarts.value += 1
    const bucket = ensureSource(source)
    bucket.listenerStarts += 1
    bucket.updatedAt = nowIso()
    persist()
  }

  function trackListenerStop(source) {
    listenerStops.value += 1
    const bucket = ensureSource(source)
    bucket.listenerStops += 1
    bucket.updatedAt = nowIso()
    persist()
  }

  function resetSession() {
    sessionStartedAt.value = nowIso()
    estimatedReads.value = 0
    estimatedWrites.value = 0
    listenerStarts.value = 0
    listenerStops.value = 0
    bySource.value = {}
    persist()
  }

  return {
    sessionStartedAt,
    estimatedReads,
    estimatedWrites,
    listenerStarts,
    listenerStops,
    activeListeners,
    bySource,
    trackReadEstimate,
    trackWriteEstimate,
    trackListenerStart,
    trackListenerStop,
    resetSession,
  }
})