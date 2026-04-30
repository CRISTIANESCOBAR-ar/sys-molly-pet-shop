// node scripts/generateIcons.js
import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_SIMPLE = join(__dirname, '..', 'public', 'Molly_Simple.png')
const SRC_BANNER = join(__dirname, '..', 'public', 'Molly_Banner_Publicidad.tiff')
const DEST  = join(__dirname, '..', 'public', 'icons')

async function main() {
  // 1. Recortar espacio blanco automáticamente, dejar un padding del 0%
  const trimmed = await sharp(SRC_SIMPLE)
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
    .resize(32, 32, { fit: 'contain', background: '#ffffff' })
    .png()
    .toFile(join(DEST, 'favicon-32.png'))
  console.log('✓ favicon-32.png (32x32)')

  // 2. Procesar el banner (Molly_Banner_Publicidad.tiff)
  // Recortar y ajustar para mostrar lo central y generar versión .webp
  await sharp(SRC_BANNER)
    // El extract dependerá de las verdaderas dimensiones del TIFF.
    // Usamos resize + crop (cover) centrado para que quede un rectangulo horizontal para el splash
    .resize(800, 450, { fit: 'cover', position: 'attention' })
    .webp({ quality: 90 })
    .toFile(join(__dirname, '..', 'public', 'splash_banner.webp'))
  console.log('✓ splash_banner.webp (800x450)')

  console.log('\nTodos los íconos generados correctamente.')
}

main().catch(e => { console.error(e); process.exit(1) })
