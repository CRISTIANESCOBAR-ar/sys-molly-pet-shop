/**
 * Script para crear usuarios y asignar roles en Firebase Auth.
 *
 * USO:
 *   1. Descargá la service account key desde Firebase Console:
 *      Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada
 *      Guardala como: scripts/serviceAccountKey.json  (NUNCA la subas a git)
 *
 *   2. Ejecutá:
 *      node scripts/setupUsers.js
 */

import admin from 'firebase-admin'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// ── Carga la service account key ──────────────────────────────────────────────
let serviceAccount
try {
  serviceAccount = require('./serviceAccountKey.json')
} catch {
  console.error('\n❌ No se encontró scripts/serviceAccountKey.json')
  console.error('   Descargala desde: Firebase Console → Configuración → Cuentas de servicio\n')
  process.exit(1)
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

// ── Define los usuarios a crear o actualizar ──────────────────────────────────
//    role: 'admin' | 'cajero'
//    Si el usuario ya existe, solo actualiza el Custom Claim del rol.
const USUARIOS = [
  {
    email:       'roxanarnv@gmail.com',
    displayName: 'Roxana (Admin)',
    role:        'admin',
    password:    'Molly2026!',
  },
  {
    email:       'cristianescobar@hotmail.com',
    displayName: 'Cristian (Admin)',
    role:        'admin',
    password:    'Admin2026!',
  },
]

// ── Lógica principal ──────────────────────────────────────────────────────────
async function setupUsuario({ email, displayName, role, password }) {
  let uid

  try {
    // Intentar obtener usuario existente
    const userRecord = await admin.auth().getUserByEmail(email)
    uid = userRecord.uid
    console.log(`ℹ️  Usuario ya existe: ${email} (uid: ${uid})`)
  } catch {
    // No existe → crearlo
    if (!password || password === 'CAMBIAR_ESTA_CONTRASEÑA') {
      console.error(`\n❌ Definí una contraseña para ${email} antes de ejecutar el script\n`)
      process.exit(1)
    }
    const newUser = await admin.auth().createUser({ email, displayName, password })
    uid = newUser.uid
    console.log(`✅ Usuario creado: ${email} (uid: ${uid})`)
  }

  // Asignar Custom Claim de rol
  await admin.auth().setCustomUserClaims(uid, { role })
  console.log(`🔑 Rol asignado: ${email} → '${role}'`)
}

async function main() {
  console.log('\n🐾 Molly Petshop — Setup de usuarios\n')
  for (const usuario of USUARIOS) {
    await setupUsuario(usuario)
  }
  console.log('\n✨ Listo. Los usuarios pueden ingresar a la app.\n')
  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
