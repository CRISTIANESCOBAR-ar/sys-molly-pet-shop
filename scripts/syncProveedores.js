/**
 * syncProveedores.js
 *
 * Sincroniza la colección `proveedores` a partir de los valores únicos del
 * campo `proveedor` presentes en la colección `productos`.
 *
 * Uso:
 *   node scripts/syncProveedores.js
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'serviceAccountKey.json'), 'utf8'),
)

initializeApp({ credential: cert(serviceAccount) })

const db = getFirestore()

function normalizarProveedor(valor) {
  return String(valor || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

async function syncProveedores() {
  const productosSnap = await db.collection('productos').get()
  if (productosSnap.empty) {
    console.log('⚠️  No hay productos en Firestore. Nada para sincronizar.')
    process.exit(0)
  }

  const proveedoresDesdeProductos = new Map()

  for (const doc of productosSnap.docs) {
    const data = doc.data()
    const nombre = normalizarProveedor(data.proveedor)
    if (!nombre) continue
    if (!proveedoresDesdeProductos.has(nombre)) {
      proveedoresDesdeProductos.set(nombre, {
        nombre,
        contacto: '',
        saldo_pendiente: 0,
      })
    }
  }

  const proveedoresSnap = await db.collection('proveedores').get()
  const existentes = new Map(
    proveedoresSnap.docs.map(doc => [normalizarProveedor(doc.data().nombre), doc.id]),
  )

  const batch = db.batch()
  let creados = 0

  for (const [nombre, payload] of proveedoresDesdeProductos.entries()) {
    if (existentes.has(nombre)) continue
    const ref = db.collection('proveedores').doc()
    batch.set(ref, payload)
    creados += 1
  }

  if (creados === 0) {
    console.log('✅ La colección "proveedores" ya estaba sincronizada.')
    process.exit(0)
  }

  await batch.commit()

  console.log(`✅ ${creados} proveedores creados desde productos.`)
  console.log(`📦 Total detectado en productos: ${proveedoresDesdeProductos.size}`)
  console.log(`🧾 Total previo en proveedores: ${proveedoresSnap.size}`)
  process.exit(0)
}

syncProveedores().catch(err => {
  console.error('❌ Error sincronizando proveedores:', err)
  process.exit(1)
})