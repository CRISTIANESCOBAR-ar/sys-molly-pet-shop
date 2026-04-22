/**
 * Script para importar el catálogo inicial de 43 productos a Firestore.
 * Solo crea documentos si la colección "productos" está vacía.
 *
 * USO:
 *   node scripts/seedProductos.js
 */

import admin from 'firebase-admin'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

const PRODUCTOS_SEED = [
  { nombre: '4 HUELLAS GATO 20KG',               categoria: 'ALIMENTO', proveedor: 'FY P',               stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: '4 HUELLAS GATO KITTEN 20KG',         categoria: 'ALIMENTO', proveedor: 'FY P',               stock: 0, stock_minimo: 3,  precio: 0, precio_actualizado: null },
  { nombre: '7 VIDAS GATO ADULTO CARNE Y POLLO',  categoria: 'ALIMENTO', proveedor: 'NATA',               stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: '7 VIDAS GATO ADULTO SALMON 10KG',    categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock: 0, stock_minimo: 3,  precio: 0, precio_actualizado: null },
  { nombre: 'AGILITY URINARY',                    categoria: 'ALIMENTO', proveedor: 'NATA',               stock: 0, stock_minimo: 4,  precio: 0, precio_actualizado: null },
  { nombre: 'AGROCAN',                            categoria: 'ALIMENTO', proveedor: 'MAS DISTRIBUCIONES', stock: 0, stock_minimo: 10, precio: 0, precio_actualizado: null },
  { nombre: 'ARROCIN 30KG',                       categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock: 0, stock_minimo: 2,  precio: 0, precio_actualizado: null },
  { nombre: 'BALANCEAR GATO PESCADO',             categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'CAN ACTIVE ADULTO 20KG',             categoria: 'ALIMENTO', proveedor: 'FY P',               stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'CARIAMICI CACHORRO',                 categoria: 'ALIMENTO', proveedor: 'MAS DISTRIBUCIONES', stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'CARIAMICI GATO POLLO Y ATUN',        categoria: 'ALIMENTO', proveedor: 'MAS DISTRIBUCIONES', stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'CARIAMICI PERRO RAZA PEQUEÑA',       categoria: 'ALIMENTO', proveedor: 'MAS DISTRIBUCIONES', stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'CAT CHOW MIX CARNE/PESCADO',         categoria: 'ALIMENTO', proveedor: 'GENERAL',            stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'DOG CHOW ADULTO RAZA PEQUEÑA',       categoria: 'ALIMENTO', proveedor: 'POCAS PULGAS',       stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'DOG SELECTION ADULTO CARNE Y POLLO', categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'DOG SELECTION CACHORRO',             categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'DOGUI',                              categoria: 'ALIMENTO', proveedor: 'NATA',               stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'ESTAMPA PLUS PERRO ADULTO',          categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'MAIZ ENTERO 30KG',                   categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock: 0, stock_minimo: 2,  precio: 0, precio_actualizado: null },
  { nombre: 'MANADA ADULTO',                      categoria: 'ALIMENTO', proveedor: 'CARAM',              stock: 0, stock_minimo: 10, precio: 0, precio_actualizado: null },
  { nombre: 'PEDIGREE CACHORRO',                  categoria: 'ALIMENTO', proveedor: 'CARAM',              stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'RAZA GATO ADULTO PESCADO 10KG',      categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock: 0, stock_minimo: 3,  precio: 0, precio_actualizado: null },
  { nombre: 'SABROSITOS GATO MIX',                categoria: 'ALIMENTO', proveedor: 'CARAM',              stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'VAGONETA PERRO ADULTO',              categoria: 'ALIMENTO', proveedor: 'SCHIARELLO',         stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'WHISKAS CARNE',                      categoria: 'ALIMENTO', proveedor: 'CARAM',              stock: 0, stock_minimo: 10, precio: 0, precio_actualizado: null },
  { nombre: 'WHISKAS PESCADO',                    categoria: 'ALIMENTO', proveedor: 'CARAM',              stock: 0, stock_minimo: 10, precio: 0, precio_actualizado: null },
  { nombre: 'HECTOPAR PIPETA GATO',               categoria: 'SALUD',    proveedor: 'MAS DISTRIBUCIONES', stock: 0, stock_minimo: 12, precio: 0, precio_actualizado: null },
  { nombre: 'IVER VETUE IVERMECTINA 1%',          categoria: 'SALUD',    proveedor: 'SCHIARELLO',         stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'SIMPARICA (TODOS LOS TAMAÑOS)',      categoria: 'SALUD',    proveedor: 'MAS DISTRIBUCIONES', stock: 0, stock_minimo: 3,  precio: 0, precio_actualizado: null },
  { nombre: 'HECTOPAR TALCO PLUS',                categoria: 'SALUD',    proveedor: 'MAS DISTRIBUCIONES', stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'FRESH CAT PIEDRA SANITARIA',         categoria: 'HIGIENE',  proveedor: 'SCHIARELLO',         stock: 0, stock_minimo: 20, precio: 0, precio_actualizado: null },
  { nombre: 'POOPY PETS COLCHON SANITARIO',       categoria: 'HIGIENE',  proveedor: 'SCHIARELLO',         stock: 0, stock_minimo: 10, precio: 0, precio_actualizado: null },
  { nombre: 'SHAMPU Y ACONDICIONADOR ELMER',      categoria: 'HIGIENE',  proveedor: 'MAS DISTRIBUCIONES', stock: 0, stock_minimo: 6,  precio: 0, precio_actualizado: null },
  { nombre: 'PIEDRA AGLUTINANTE LAVANDA 4KG',     categoria: 'HIGIENE',  proveedor: 'FY P',               stock: 0, stock_minimo: 10, precio: 0, precio_actualizado: null },
  { nombre: 'CEPILLO MASAJEADOR PANDA',           categoria: 'ACCESORIO',proveedor: 'SCHIARELLO',         stock: 0, stock_minimo: 4,  precio: 0, precio_actualizado: null },
  { nombre: 'COMEDERO ACERO INOXIDABLE',          categoria: 'ACCESORIO',proveedor: 'FY P',               stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'KIT SANITARIO JUMBO',                categoria: 'ACCESORIO',proveedor: 'FY P',               stock: 0, stock_minimo: 2,  precio: 0, precio_actualizado: null },
  { nombre: 'PECHERA CAPIBARA',                   categoria: 'ACCESORIO',proveedor: 'GENERAL',            stock: 0, stock_minimo: 3,  precio: 0, precio_actualizado: null },
  { nombre: 'PEINE VAPORIZADOR PET BRUSH',        categoria: 'ACCESORIO',proveedor: 'SCHIARELLO',         stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'COLLAR ISABELLINO',                  categoria: 'ACCESORIO',proveedor: 'GENERAL',            stock: 0, stock_minimo: 2,  precio: 0, precio_actualizado: null },
  { nombre: 'PELOTA DE GOMA CON SOGA',            categoria: 'ACCESORIO',proveedor: 'FY P',               stock: 0, stock_minimo: 5,  precio: 0, precio_actualizado: null },
  { nombre: 'RASCADOR INFINITO',                  categoria: 'ACCESORIO',proveedor: 'FY P',               stock: 0, stock_minimo: 2,  precio: 0, precio_actualizado: null },
  { nombre: 'REMERAS Y VESTIDOS',                 categoria: 'ACCESORIO',proveedor: 'MAS DISTRIBUCIONES', stock: 0, stock_minimo: 10, precio: 0, precio_actualizado: null },
]

async function seed() {
  // Verificar si ya hay productos cargados
  const snap = await db.collection('productos').limit(1).get()
  if (!snap.empty) {
    console.log('⚠️  La colección "productos" ya tiene documentos. Abortando para no duplicar.')
    console.log('   Si querés re-seedear, borralos primero desde la consola de Firebase.')
    process.exit(0)
  }

  console.log(`\nImportando ${PRODUCTOS_SEED.length} productos...`)
  const batch = db.batch()

  for (const producto of PRODUCTOS_SEED) {
    const docRef = db.collection('productos').doc()
    batch.set(docRef, {
      ...producto,
      creado_en: admin.firestore.FieldValue.serverTimestamp(),
      actualizado_en: admin.firestore.FieldValue.serverTimestamp(),
    })
  }

  await batch.commit()
  console.log(`✅ ${PRODUCTOS_SEED.length} productos importados correctamente.\n`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Error durante el seed:', err)
  process.exit(1)
})
