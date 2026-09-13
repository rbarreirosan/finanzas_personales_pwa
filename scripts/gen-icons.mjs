// Genera los iconos PNG de la PWA a partir de public/icons/icon.svg.
// Uso: npm run gen:icons
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');
const svgPath = join(iconsDir, 'icon.svg');

// apple-touch-icon: iOS no respeta transparencia, se pinta sobre fondo solido.
const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

const svg = await readFile(svgPath);

for (const t of targets) {
  await sharp(svg, { density: 384 })
    .resize(t.size, t.size)
    .png()
    .toFile(join(iconsDir, t.file));
  console.log('✓', t.file, `${t.size}x${t.size}`);
}
console.log('Iconos generados en', iconsDir);
