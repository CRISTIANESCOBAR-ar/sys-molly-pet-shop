/**
 * importCompras.js
 * Importa el historial de compras 2026 desde public/Compras_2026.xlsx a Firestore.
 * Colección: `compras`
 * Además actualiza precio_compra y precio_venta en `productos` con la compra más reciente.
 *
 * Uso: node scripts/importCompras.js
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const require = createRequire(import.meta.url)
const XLSX    = require('xlsx')

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Firebase Admin ──────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'serviceAccountKey.json'), 'utf8'),
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

// ─── Convertir fecha serial de Excel a Date ──────────────────────────────────
function excelDateToJS(serial) {
  // Excel cuenta desde 01/01/1900. JS desde 01/01/1970.
  // 25569 = días entre ambas épocas (con el bug de bisiesto de Excel)
  return new Date((serial - 25569) * 86400 * 1000)
}

// ─── Normalizar nombre de proveedor ─────────────────────────────────────────
function normalizarProveedor(raw) {
  const m = (raw || '').trim().toUpperCase()
  const mapa = {
    'MAS':           'MAS',
    'CARAM':         'CARAM',
    'SCHIARELLO':    'SCHIARELLO',
    'LAURITA HNOS':  'LAURITA HNOS',
    'FY P':          'FY P',
    'NATA':          'NATA',
  }
  return mapa[m] || m || 'DESCONOCIDO'
}

// ─── Parsear una fila ────────────────────────────────────────────────────────
// Columnas: FECHA | CANT | NOMBRE | KG | PRECIO UN | 21% IVA | TOTAL IVA | TOTAL | 0.2 | BOLSA PUBLICO | PROVEEDOR | PRECIO NUEVO
function parsearFila(row) {
  const [fechaSerial, cantRaw, nombreRaw, col3, col4, col5, , totalRaw, , bolsaPublicoRaw, proveedorRaw] = row

  // Saltar headers repetidos y filas vacías
  if (!fechaSerial || typeof fechaSerial === 'string') return null
  if (!nombreRaw || typeof nombreRaw !== 'string') return null

  const nombre   = nombreRaw.trim().toUpperCase()
  const cantidad = parseFloat(cantRaw) || 1
  const total    = parseFloat(totalRaw) || 0
  const precioVenta = parseFloat(bolsaPublicoRaw) || 0

  // Detectar presentación vs precio lista en col3
  let presentacion = ''
  let precioCompra = parseFloat(col4) || 0

  if (typeof col3 === 'string' && col3.trim()) {
    // col3 es texto (ej: "20 KG", "15 kg") → es la presentación
    presentacion = col3.trim()
  } else if (typeof col3 === 'number' && col3 > 100) {
    // col3 es precio de lista (formato tardío del Excel) → col4 es precio real
    precioCompra = parseFloat(col4) || 0
  }

  // Detectar si tiene IVA (col5 no vacío y col5 === col4, o col5 es aprox 21% de col4)
  const ivaRaw = parseFloat(col5) || 0
  const tieneIva = ivaRaw > 0 && Math.abs(ivaRaw - precioCompra * 0.21) < precioCompra * 0.05

  return {
    fecha:        excelDateToJS(fechaSerial),
    nombre,
    cantidad,
    presentacion,
    precio_compra:     precioCompra,
    precio_compra_iva: tieneIva ? parseFloat(col5) : 0,
    precio_venta:      precioVenta,
    total,
    proveedor:    normalizarProveedor(proveedorRaw),
    origen:       'historial_2026',
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🐾 Molly Petshop — Importación de compras 2026\n')

  // Leer Excel
  const wb   = XLSX.readFile(join(__dirname, '../public/Compras_2026.xlsx'))
  const ws   = wb.Sheets['COMPRAS 2026']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  // Parsear filas
  const compras = rows.map(parsearFila).filter(Boolean)
  console.log(`📋 ${compras.length} compras parseadas del Excel`)

  // ── Importar a Firestore en batches ──────────────────────────────────────
  const BATCH_SIZE = 499
  let importadas   = 0

  for (let i = 0; i < compras.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = compras.slice(i, i + BATCH_SIZE)
    for (const c of chunk) {
      const ref = db.collection('compras').doc()
      batch.set(ref, {
        ...c,
        fecha: Timestamp.fromDate(c.fecha),
      })
    }
    await batch.commit()
    importadas += chunk.length
    console.log(`  ✓ ${importadas} compras guardadas...`)
  }

  console.log(`\n✅ ${importadas} compras importadas a Firestore.`)

  // ── Actualizar precios en productos (última compra por nombre) ───────────
  console.log('\n🔄 Actualizando precios en productos...')

  // Tomar la compra más reciente por nombre de producto (mayor fecha)
  const latestByName = new Map()
  for (const c of compras) {
    const existing = latestByName.get(c.nombre)
    if (!existing || c.fecha > existing.fecha) {
      latestByName.set(c.nombre, c)
    }
  }

  // Leer productos existentes
  const productosSnap = await db.collection('productos').get()
  const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  let actualizados  = 0
  let noEncontrados = []

  for (const [nombreCompra, compra] of latestByName) {
    // Buscar match exacto (case-insensitive)
    const prod = productos.find(p =>
      p.nombre.toUpperCase().trim() === nombreCompra,
    )

    if (prod && compra.precio_venta > 0) {
      await db.collection('productos').doc(prod.id).update({
        precio_compra:        compra.precio_compra,
        precio_venta:         compra.precio_venta,
        precio_actualizado:   Timestamp.fromDate(compra.fecha),
        actualizado_en:       Timestamp.now(),
      })
      console.log(`  ✓ ${prod.nombre}: compra $${compra.precio_compra} → venta $${compra.precio_venta}`)
      actualizados++
    } else if (!prod) {
      noEncontrados.push(nombreCompra)
    }
  }

  console.log(`\n✅ ${actualizados} productos actualizados con precios.`)

  if (noEncontrados.length > 0) {
    console.log(`\n⚠️  ${noEncontrados.length} productos de compras SIN match en catálogo:`)
    noEncontrados.forEach(n => console.log(`   - ${n}`))
  }
}

main().catch(console.error)
