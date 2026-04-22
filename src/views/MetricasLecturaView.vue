<script setup>
import { computed } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useUsageMetricsStore } from '@/stores/useUsageMetricsStore'

const metricsStore = useUsageMetricsStore()

const rows = computed(() => {
  const entries = Object.entries(metricsStore.bySource || {})
  return entries
    .map(([source, data]) => ({
      source,
      reads: Number(data?.reads || 0),
      writes: Number(data?.writes || 0),
      listenerStarts: Number(data?.listenerStarts || 0),
      listenerStops: Number(data?.listenerStops || 0),
      updatedAt: data?.updatedAt || '',
    }))
    .sort((a, b) => (b.reads + b.writes) - (a.reads + a.writes))
})

const updatedAtLabel = computed(() => {
  if (rows.value.length === 0) return 'Sin eventos todavía'
  const iso = rows.value[0].updatedAt
  if (!iso) return 'Sin eventos todavía'
  return new Date(iso).toLocaleString('es-AR')
})
</script>

<template>
  <div class="flex flex-col min-h-screen bg-gray-50">
    <NavBar />

    <main class="max-w-6xl mx-auto w-full px-4 py-5 md:px-6 md:py-7 space-y-4">
      <section class="bg-white rounded-2xl border border-gray-100 p-4 md:p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h1 class="text-xl md:text-2xl font-extrabold text-gray-800">Métricas de Firestore (estimadas)</h1>
            <p class="text-sm text-gray-500 mt-1">Session iniciada: {{ new Date(metricsStore.sessionStartedAt).toLocaleString('es-AR') }}</p>
            <p class="text-sm text-gray-400">Última actividad: {{ updatedAtLabel }}</p>
          </div>
          <button
            @click="metricsStore.resetSession()"
            class="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Reiniciar sesión
          </button>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div class="rounded-xl bg-blue-50 border border-blue-100 p-3">
            <p class="text-xs text-blue-500 font-semibold">Lecturas estimadas</p>
            <p class="text-2xl font-extrabold text-blue-700">{{ metricsStore.estimatedReads }}</p>
          </div>
          <div class="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
            <p class="text-xs text-emerald-500 font-semibold">Escrituras estimadas</p>
            <p class="text-2xl font-extrabold text-emerald-700">{{ metricsStore.estimatedWrites }}</p>
          </div>
          <div class="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <p class="text-xs text-amber-600 font-semibold">Listeners iniciados</p>
            <p class="text-2xl font-extrabold text-amber-700">{{ metricsStore.listenerStarts }}</p>
          </div>
          <div class="rounded-xl bg-violet-50 border border-violet-100 p-3">
            <p class="text-xs text-violet-600 font-semibold">Listeners activos</p>
            <p class="text-2xl font-extrabold text-violet-700">{{ metricsStore.activeListeners }}</p>
          </div>
        </div>
      </section>

      <section class="bg-white rounded-2xl border border-gray-100 p-4 md:p-5 shadow-sm">
        <h2 class="text-base md:text-lg font-bold text-gray-800 mb-3">Detalle por origen</h2>
        <div v-if="rows.length === 0" class="text-sm text-gray-400">Todavía no hay eventos medidos en esta sesión.</div>

        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[760px] text-sm">
            <thead>
              <tr class="text-left text-gray-500 border-b border-gray-100">
                <th class="py-2 pr-3">Origen</th>
                <th class="py-2 pr-3">Lecturas</th>
                <th class="py-2 pr-3">Escrituras</th>
                <th class="py-2 pr-3">Starts</th>
                <th class="py-2 pr-3">Stops</th>
                <th class="py-2">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.source" class="border-b border-gray-50 text-gray-700">
                <td class="py-2 pr-3 font-medium">{{ r.source }}</td>
                <td class="py-2 pr-3">{{ r.reads }}</td>
                <td class="py-2 pr-3">{{ r.writes }}</td>
                <td class="py-2 pr-3">{{ r.listenerStarts }}</td>
                <td class="py-2 pr-3">{{ r.listenerStops }}</td>
                <td class="py-2">{{ r.updatedAt ? new Date(r.updatedAt).toLocaleString('es-AR') : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>