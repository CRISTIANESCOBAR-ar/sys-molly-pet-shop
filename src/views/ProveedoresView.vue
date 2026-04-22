<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useProveedoresStore } from '@/stores/useProveedoresStore'

const proveedoresStore = useProveedoresStore()

let unsubProv

onMounted(() => { unsubProv = proveedoresStore.subscribeProveedores() })
onUnmounted(() => unsubProv?.())

// ─── Modal nuevo proveedor ──────────────────────────────────────────────────
const modalAbierto = ref(false)
const form = ref({ nombre: '', contacto: '', web_instagram: '' })
const busqueda = ref('')

const editandoId = ref('')
const formEdicion = ref({ contacto: '', web_instagram: '' })

function linkProveedor(valor) {
  const raw = String(valor || '').trim()
  if (!raw) return null

  if (raw.startsWith('@')) {
    return `https://instagram.com/${raw.slice(1)}`
  }

  if (/^https?:\/\//i.test(raw)) return raw
  if (/^www\./i.test(raw)) return `https://${raw}`
  if (/instagram\.com\//i.test(raw)) return `https://${raw}`
  return null
}

const proveedoresFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return proveedoresStore.proveedores

  return proveedoresStore.proveedores.filter(prov => {
    const nombre = String(prov.nombre || '').toLowerCase()
    const contacto = String(prov.contacto || '').toLowerCase()
    const web = String(prov.web_instagram || '').toLowerCase()
    return nombre.includes(q) || contacto.includes(q) || web.includes(q)
  })
})

function iniciarEdicion(prov) {
  editandoId.value = prov.id
  formEdicion.value = {
    contacto: prov.contacto || '',
    web_instagram: prov.web_instagram || '',
  }
}

function cancelarEdicion() {
  editandoId.value = ''
  formEdicion.value = { contacto: '', web_instagram: '' }
}

async function guardarEdicion(provId) {
  await proveedoresStore.actualizarProveedor(provId, {
    contacto: formEdicion.value.contacto,
    web_instagram: formEdicion.value.web_instagram,
  })
  cancelarEdicion()
}

async function guardar() {
  if (!form.value.nombre.trim()) return
  await proveedoresStore.agregarProveedor(form.value)
  modalAbierto.value = false
  form.value = { nombre: '', contacto: '', web_instagram: '' }
}
</script>

<template>
  <div class="flex flex-col min-h-screen bg-gray-50">
    <NavBar />

    <main class="flex-1 max-w-6xl mx-auto w-full px-4 py-4 md:py-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 class="text-xl font-bold text-gray-800">Proveedores</h1>
          <p class="text-sm text-gray-400">{{ proveedoresFiltrados.length }} proveedores</p>
        </div>
        <button
          @click="modalAbierto = true"
          class="bg-green-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-green-600 transition-colors"
        >
          + Nuevo
        </button>
      </div>

      <div class="mb-3">
        <input
          v-model="busqueda"
          type="search"
          placeholder="Buscar por nombre, contacto o web..."
          class="w-full max-w-md px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="max-h-[calc(100vh-200px)] overflow-auto">
          <table class="w-full text-sm min-w-[880px]">
            <thead class="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
            <tr>
              <th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
              <th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Contacto</th>
              <th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Web / Instagram</th>
              <th class="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Saldo pendiente</th>
              <th class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase text-right">Acciones</th>
            </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="prov in proveedoresFiltrados" :key="prov.id" class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-2.5 font-medium text-gray-800">{{ prov.nombre }}</td>
                <td class="px-4 py-2.5 text-gray-500">
                  <input
                    v-if="editandoId === prov.id"
                    v-model="formEdicion.contacto"
                    type="text"
                    class="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="Contacto"
                  />
                  <span v-else>{{ prov.contacto || '—' }}</span>
                </td>
                <td class="px-4 py-2.5 text-gray-500">
                  <input
                    v-if="editandoId === prov.id"
                    v-model="formEdicion.web_instagram"
                    type="text"
                    class="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="@usuario o URL"
                  />
                  <template v-else>
                    <a
                      v-if="linkProveedor(prov.web_instagram)"
                      :href="linkProveedor(prov.web_instagram)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-green-700 hover:text-green-800 hover:underline"
                    >
                      {{ prov.web_instagram }}
                    </a>
                    <span v-else>{{ prov.web_instagram || '—' }}</span>
                  </template>
                </td>
                <td class="px-4 py-2.5 text-right font-bold"
                :class="prov.saldo_pendiente > 0 ? 'text-red-600' : 'text-gray-400'"
                >
                  ${{ (prov.saldo_pendiente ?? 0).toLocaleString('es-AR') }}
                </td>
                <td class="px-4 py-2.5 text-right">
                  <div class="inline-flex gap-2">
                    <button
                      v-if="editandoId !== prov.id"
                      @click="iniciarEdicion(prov)"
                      class="text-xs text-gray-500 hover:text-gray-800 transition-colors"
                    >
                      Editar
                    </button>
                    <template v-else>
                      <button
                        @click="guardarEdicion(prov.id)"
                        class="text-xs text-green-600 hover:text-green-700 font-semibold transition-colors"
                      >
                        Guardar
                      </button>
                      <button
                        @click="cancelarEdicion"
                        class="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        Cancelar
                      </button>
                    </template>
                  </div>
                </td>
              </tr>
              <tr v-if="proveedoresFiltrados.length === 0">
                <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">Sin proveedores para la búsqueda actual</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <!-- Modal -->
    <Teleport to="body">
      <div
        v-if="modalAbierto"
        class="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
        @click.self="modalAbierto = false"
      >
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
          <h3 class="text-base font-bold text-gray-800 mb-4">Nuevo proveedor</h3>
          <form @submit.prevent="guardar" class="space-y-3">
            <div>
              <label class="text-xs text-gray-500">Nombre *</label>
              <input v-model="form.nombre" type="text" required
                class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label class="text-xs text-gray-500">Contacto</label>
              <input v-model="form.contacto" type="text"
                class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label class="text-xs text-gray-500">Web o Instagram</label>
              <input v-model="form.web_instagram" type="text" placeholder="@usuario o https://sitio.com"
                class="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div class="flex gap-3 pt-1">
              <button type="button" @click="modalAbierto = false"
                class="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit"
                class="flex-1 py-2.5 bg-green-500 text-white font-semibold rounded-xl text-sm hover:bg-green-600 transition-colors">
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
