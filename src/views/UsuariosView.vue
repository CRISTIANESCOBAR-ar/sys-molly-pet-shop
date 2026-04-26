<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useUsuariosStore } from '@/stores/useUsuariosStore'

const store = useUsuariosStore()

const resetando    = ref(null)   
const mensajeExito = ref('')     
const error        = ref('')     
const mostrarModal = ref(false)

const usuarioForm = ref({ uid: null, nombre: '', email: '', password: '', role: 'cajero' })
const procesando  = ref(false)
const modoEdicion = ref(false)

let unsub
onMounted(()  => { unsub = store.subscribe() })
onUnmounted(() => { unsub?.() })

// ── Etiquetas de rol ──────────────────────────────────────────────────────────
const ETIQUETA_ROL = {
  admin:  { label: 'Admin',  bg: 'bg-green-100 text-green-700' },
  cajero: { label: 'Cajero', bg: 'bg-emerald-100 text-emerald-700' },
}

// ── Enviar reset ──────────────────────────────────────────────────────────────
async function resetPassword(usuario) {
  resetando.value    = usuario.uid
  mensajeExito.value = ''
  error.value        = ''
  try {
    await store.enviarResetPassword(usuario.email)
    mensajeExito.value = `Se envió el correo de restablecimiento a ${usuario.email}.`
    setTimeout(() => { mensajeExito.value = '' }, 5000)
  } catch (e) {
    error.value = e.message
  } finally {
    resetando.value = null
  }
}

async function handleGuardar() {
  error.value = ''
  mensajeExito.value = ''
  procesando.value = true
  try {
    if (modoEdicion.value) {
      // 📝 Editar en Firestore
      await store.guardarUsuario({
        uid: usuarioForm.value.uid,
        email: usuarioForm.value.email, // read-only ref
        nombre: usuarioForm.value.nombre,
        role: usuarioForm.value.role,
      })
      mensajeExito.value = `Usuario actualizado con éxito.`
    } else {
      // 🚀 Crear nuevo
      await store.crearUsuario({
        email: usuarioForm.value.email,
        password: usuarioForm.value.password,
        nombre: usuarioForm.value.nombre,
        role: usuarioForm.value.role,
      })
      mensajeExito.value = `Usuario ${usuarioForm.value.email} creado con éxito.`
    }
    cerrarModal()
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      error.value = 'El correo ya está en uso'
    } else if (e.code === 'auth/weak-password') {
       error.value = 'La contraseña debe tener al menos 6 caracteres'
    } else {
      error.value = e.message
    }
  } finally {
    procesando.value = false
  }
}

function abrirModalNuevo() {
  modoEdicion.value = false
  usuarioForm.value = { uid: null, nombre: '', email: '', password: '', role: 'cajero' }
  mostrarModal.value = true
  error.value = ''
}

function abrirModalEditar(u) {
  modoEdicion.value = true
  usuarioForm.value = { uid: u.uid, nombre: u.nombre, email: u.email, password: '', role: u.role || 'cajero' }
  mostrarModal.value = true
  error.value = ''
}

function cerrarModal() {
  mostrarModal.value = false
}

</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50">
    <NavBar />

    <main class="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-3xl mx-auto w-full">

      <!-- Encabezado -->
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Usuarios</h1>
          <p class="text-sm text-gray-500 mt-1">
            Gestioná los usuarios y roles de Molly Petshop.
          </p>
        </div>
        <button
          @click="abrirModalNuevo"
          class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg text-sm shadow-sm transition-colors"
        >
          + Nuevo
        </button>
      </div>

      <!-- Alertas -->
      <div v-if="mensajeExito" class="mb-4 flex items-start gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
        {{ mensajeExito }}
      </div>
      <div v-if="error" class="mb-4 flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
        {{ error }}
        <button class="ml-auto text-red-500 hover:text-red-700" v-tippy="'Ocultar mensaje'" @click="error = ''">✕</button>
      </div>

      <!-- Tabla de usuarios -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div v-if="store.usuarios.length === 0" class="py-16 text-center text-gray-400 text-sm">
          No hay usuarios registrados en Firestore.
        </div>
        <ul v-else class="divide-y divide-gray-50">
          <li v-for="u in store.usuarios" :key="u.uid" class="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-gray-900 truncate">{{ u.nombre }}</p>
              <p class="text-xs text-gray-500 truncate">{{ u.email }}</p>
            </div>
            <span :class="['flex-shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full', ETIQUETA_ROL[u.role]?.bg ?? 'bg-gray-100 text-gray-600']">
              {{ ETIQUETA_ROL[u.role]?.label ?? u.role }}
            </span>
            <div class="flex gap-2 items-center">
              <!-- Botón Editar -->
              <button
                @click="abrirModalEditar(u)"
                v-tippy="'Editar datos y rol del usuario'"
                class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.89 1.114l-2.81 1.015 1.014-2.81a4.5 4.5 0 0 1 1.114-1.89l12.602-12.602Zm0 0L19.5 7.125" />
                </svg>
              </button>
              
              <!-- Botón Restablecer Contraseña -->
              <button
                v-tippy="'Enviar correo para restablecer la contraseña'"
                @click="resetPassword(u)"
                :disabled="resetando === u.uid"
                class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                <span v-if="resetando === u.uid" class="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></span>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </button>
            </div>
          </li>
        </ul>
      </div>
    </main>

    <!-- Modal Nuevo Usuario -->
    <div v-if="mostrarModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div class="bg-white rounded-2xl w-full max-w-sm shadow-xl flex flex-col overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100">
          <h2 class="text-lg font-bold text-gray-900">{{ modoEdicion ? 'Editar Usuario' : 'Nuevo Usuario' }}</h2>
        </div>
        
        <form @submit.prevent="handleGuardar" class="p-5 flex flex-col gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
            <input v-model="usuarioForm.nombre" type="text" required class="w-full border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500 text-sm py-2 px-3 border" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input v-model="usuarioForm.email" type="email" required :disabled="modoEdicion" :class="['w-full border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500 text-sm py-2 px-3 border', modoEdicion ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : '']" />
          </div>
          <div v-if="!modoEdicion">
            <label class="block text-xs font-medium text-gray-700 mb-1">Contraseña</label>
            <input v-model="usuarioForm.password" type="password" required minlength="6" class="w-full border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500 text-sm py-2 px-3 border" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Rol</label>
            <select v-model="usuarioForm.role" class="w-full border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500 text-sm py-2 px-3 border">
              <option value="cajero">Cajero</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div class="mt-4 flex gap-3 justify-end">
            <button
              type="button"
              @click="cerrarModal"
              :disabled="procesando"
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="procesando"
              class="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span v-if="procesando" class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
              {{ modoEdicion ? 'Guardar Cambios' : 'Crear Usuario' }}
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>