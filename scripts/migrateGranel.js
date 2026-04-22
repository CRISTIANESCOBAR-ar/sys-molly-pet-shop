/**
 * Migración: agrega el campo `venta_granel` a los productos ya existentes en Firestore.
 *
 * USO:
 *   node scripts/migrateGranel.js
 */

import admin from 'firebase-admin'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

// Productos que se venden fraccionados por kg
const GRANEL_NOMBRES = new Set([
  '4 HUELLAS GATO 20KG',
  '4 HUELLAS GATO KITTEN 20KG',
  '7 VIDAS GATO ADULTO CARNE Y POLLO',
  '7 VIDAS GATO ADULTO SALMON 10KG',
  'AGROCAN',
  'ARROCIN 30KG',
  'BALANCEAR GATO PESCADO',
  'CAN ACTIVE ADULTO 20KG',
  'DOG SELECTION ADULTO CARNE Y POLLO',
  'ESTAMPA PLUS PERRO ADULTO',
  'MAIZ ENTERO 30KG',
  'MANADA ADULTO',
  'RAZA GATO ADULTO PESCADO 10KG',
  'VAGONETA PERRO ADULTO',
])

async function migrar() {
  const snap = await db.collection('productos').get()
  if (snap.empty) {
    console.log('⚠️  No hay productos en Firestore.')
    process.exit(0)
  }

  const batch = db.batch()
  let actualizados = 0

  for (const doc of snap.docs) {
    const nombre = doc.data().nombre ?? ''
    const venta_granel = GRANEL_NOMBRES.has(nombre)
    batch.update(doc.ref, { venta_granel })
    actualizados++
  }

  await batch.commit()
  const granelCount = [...snap.docs].filter(d => GRANEL_NOMBRES.has(d.data().nombre)).length
  console.log(`\n✅ Migración completa:`)
  console.log(`   ${actualizados} productos actualizados`)
  console.log(`   ${granelCount} marcados como venta_granel: true`)
  console.log(`   ${actualizados - granelCount} marcados como venta_granel: false\n`)
  process.exit(0)
}

migrar().catch((err) => {
  console.error('❌ Error en migración:', err)
  process.exit(1)
})
