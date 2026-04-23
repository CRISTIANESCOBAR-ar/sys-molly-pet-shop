// node scripts/generateIcons.js
import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC   = join('C:\\Users\\crist\\Downloads\\Molly.png')
const DEST  = join(__dirname, '..', 'public', 'icons')

async function main() {
  // 1. Recortar espacio blanco automáticamente, dejar un padding del 0%
  const trimmed = await sharp(SRC)
    .trim({ background: '#ffffff', threshold: 10 })
    .toBuffer()

  const sizes = [
    { name: 'favicon.png',            size: 64  },
    { name: 'icon-192.png',           size: 192 },
    { name: 'icon-512.png',           size: 512 },
    { name: 'icon-maskable-192.png',  size: 192 },
    { name: 'icon-maskable-512.png',  size: 512 },
  ]

  for (const { name, size } of sizes) {
    const isMaskable = name.includes('maskable')
    // Para maskable: el ícono ocupa el 80% del área (safe zone de 10% por lado)
    const iconSize = isMaskable ? Math.round(size * 0.80) : size

    let pipeline = sharp(trimmed).resize(iconSize, iconSize, { fit: 'contain', background: '#62ef4f' })

    if (isMaskable) {
      // Agregar padding para safe zone con fondo verde
      pipeline = pipeline.extend({
        top:    Math.round(size * 0.10),
        bottom: Math.round(size * 0.10),
        left:   Math.round(size * 0.10),
        right:  Math.round(size * 0.10),
        background: '#62ef4f',
      })
    }

    await pipeline.png().toFile(join(DEST, name))
    console.log(`✓ ${name} (${size}x${size})`)
  }

  // favicon-32 para el <link rel="icon" sizes="32x32">
  await sharp(trimmed)
    .resize(32, 32, { fit: 'contain', background: '#62ef4f' })
    .png()
    .toFile(join(DEST, 'favicon-32.png'))
  console.log('✓ favicon-32.png (32x32)')

  console.log('\nTodos los íconos generados en public/icons/')
}

main().catch(e => { console.error(e); process.exit(1) })
