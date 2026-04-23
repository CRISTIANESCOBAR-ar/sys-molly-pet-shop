<script setup>
import { ref, onErrorCaptured } from 'vue'

const errorCapturado = ref(null)

onErrorCaptured((err) => {
  errorCapturado.value = err?.message || String(err)
  console.error('[App] error capturado:', err)
  return false // no propagar
})
</script>

<template>
  <div v-if="errorCapturado" style="padding:24px;font-family:monospace;background:#fee2e2;color:#991b1b;white-space:pre-wrap">
    <strong>Error en la app:</strong><br>{{ errorCapturado }}
  </div>
  <RouterView v-else />
</template>
