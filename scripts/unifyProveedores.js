/**
 * unifyProveedores.js
 *
 * Unifica proveedores duplicados por variantes de nombre (ej: FY P, FYP, F Y P)
 * y normaliza referencias históricas en:
 * - productos.proveedor
 * - compras.proveedor
 * - cuentas_pagar.id_proveedor (cuando se fusionan docs de proveedores)
 *
 * Uso:
 *   node scripts/unifyProveedores.js --dry-run
 *   node scripts/unifyProveedores.js --apply
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

const isApply = process.argv.includes('--apply')

function collapseSpaces(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function canonicalProveedor(raw) {
  const upper = collapseSpaces(raw).toUpperCase()
  const key = upper.replace(/[^A-Z0-9]/g, '')

  const aliases = {
    FYP: 'FY P',
  }

  return {
    key,
    name: aliases[key] || upper,
  }
}

function firstNonEmpty(values) {
  for (const v of values) {
    const clean = collapseSpaces(v)
    if (clean) return clean
  }
  return ''
}

async function normalizeFieldInCollection(colName, fieldName, stats, writer) {
  const snap = await db.collection(colName).get()

  for (const doc of snap.docs) {
    const current = doc.data()?.[fieldName]
    if (!current) continue

    const next = canonicalProveedor(current).name
    if (next === current) continue

    stats[`${colName}Updated`] += 1
    if (isApply) {
      writer.update(doc.ref, { [fieldName]: next })
    }
  }
}

async function unifyProviderDocs(stats, writer) {
  const proveedoresSnap = await db.collection('proveedores').get()
  const groups = new Map()

  for (const doc of proveedoresSnap.docs) {
    const data = doc.data() || {}
    const { key, name } = canonicalProveedor(data.nombre || '')
    if (!key) continue

    if (!groups.has(key)) groups.set(key, { canonicalName: name, docs: [] })
    groups.get(key).docs.push({ id: doc.id, ref: doc.ref, data })
  }

  for (const [key, group] of groups.entries()) {
    const docs = group.docs
    if (!docs.length) continue

    const preferred = docs.find(d => canonicalProveedor(d.data.nombre).name === group.canonicalName) || docs[0]
    const rest = docs.filter(d => d.id !== preferred.id)

    const saldoTotal = docs.reduce((acc, d) => acc + Number(d.data.saldo_pendiente || 0), 0)
    const contacto = firstNonEmpty(docs.map(d => d.data.contacto))
    const webInstagram = firstNonEmpty(docs.map(d => d.data.web_instagram))

    const patch = {
      nombre: group.canonicalName,
      saldo_pendiente: saldoTotal,
      contacto,
      web_instagram: webInstagram,
    }

    const preferredCurrent = preferred.data || {}
    const needsPatch =
      preferredCurrent.nombre !== patch.nombre ||
      Number(preferredCurrent.saldo_pendiente || 0) !== patch.saldo_pendiente ||
      String(preferredCurrent.contacto || '') !== patch.contacto ||
      String(preferredCurrent.web_instagram || '') !== patch.web_instagram

    if (needsPatch) {
      stats.providerDocsUpdated += 1
      if (isApply) writer.update(preferred.ref, patch)
    }

    if (!rest.length) continue

    for (const dup of rest) {
      stats.providerDocsMerged += 1

      const cuentasSnap = await db
        .collection('cuentas_pagar')
        .where('id_proveedor', '==', dup.id)
        .get()

      for (const cuenta of cuentasSnap.docs) {
        stats.cuentasRepointed += 1
        if (isApply) writer.update(cuenta.ref, { id_proveedor: preferred.id })
      }

      if (isApply) writer.delete(dup.ref)
      stats.providerDocsDeleted += 1
    }

    console.log(`• ${key}: ${docs.length} docs -> canonical "${group.canonicalName}"`)
  }
}

async function run() {
  const stats = {
    productosUpdated: 0,
    comprasUpdated: 0,
    providerDocsUpdated: 0,
    providerDocsMerged: 0,
    providerDocsDeleted: 0,
    cuentasRepointed: 0,
  }

  const writer = db.bulkWriter()

  try {
    console.log(isApply ? '▶ Ejecutando migracion (APPLY)' : '▶ Ejecutando migracion (DRY RUN)')

    await normalizeFieldInCollection('productos', 'proveedor', stats, writer)
    await normalizeFieldInCollection('compras', 'proveedor', stats, writer)
    await unifyProviderDocs(stats, writer)

    if (isApply) await writer.close()
    else await writer.close()

    console.log('\nResumen:')
    console.log(`- productos.proveedor normalizados: ${stats.productosUpdated}`)
    console.log(`- compras.proveedor normalizados: ${stats.comprasUpdated}`)
    console.log(`- docs proveedores actualizados: ${stats.providerDocsUpdated}`)
    console.log(`- proveedores fusionados: ${stats.providerDocsMerged}`)
    console.log(`- docs proveedores eliminados: ${stats.providerDocsDeleted}`)
    console.log(`- cuentas_pagar repoint: ${stats.cuentasRepointed}`)

    if (!isApply) {
      console.log('\nℹ️ Este fue un DRY RUN. Ejecutá con --apply para aplicar cambios.')
    } else {
      console.log('\n✅ Migracion aplicada correctamente.')
    }
  } catch (err) {
    console.error('❌ Error en migracion:', err)
    process.exit(1)
  }
}

run()