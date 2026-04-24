import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Gera ícone rico (192 e 512) a partir de SVG maskable-safe
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1873f5"/>
      <stop offset="100%" stop-color="#0b5dd1"/>
    </linearGradient>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <!-- fundo com safe zone para maskable (80% do canvas) -->
  <rect width="512" height="512" fill="url(#g)"/>
  <!-- pílula central -->
  <g transform="translate(256 256) rotate(-30) translate(-140 -60)" filter="url(#s)">
    <rect x="0" y="0" width="280" height="120" rx="60" fill="#ffffff"/>
    <rect x="140" y="0" width="140" height="120" rx="60" fill="#e8f0ff"/>
    <line x1="140" y1="0" x2="140" y2="120" stroke="#1873f5" stroke-width="6"/>
  </g>
  <!-- cruz médica pequena -->
  <g transform="translate(256 380)">
    <rect x="-12" y="-36" width="24" height="72" rx="6" fill="#ffffff" opacity="0.95"/>
    <rect x="-36" y="-12" width="72" height="24" rx="6" fill="#ffffff" opacity="0.95"/>
  </g>
</svg>
`

const out = resolve('public')
await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(`${out}/icon-192.png`)
await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(`${out}/icon-512.png`)
await sharp(Buffer.from(svg)).resize(180, 180).png().toFile(`${out}/apple-touch-icon.png`)
// favicon 64
await sharp(Buffer.from(svg)).resize(64, 64).png().toFile(`${out}/favicon-64.png`)

console.log('icons geradas: icon-192.png, icon-512.png, apple-touch-icon.png, favicon-64.png')
