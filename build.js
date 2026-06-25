// build.js — injects env vars into index.html and writes to public/
// Locally:  copy .env.example → .env, fill in values, then run: node build.js
// On Vercel: runs automatically via vercel.json buildCommand

require('dotenv').config();
const fs   = require('fs');
const zlib = require('zlib');

/* ── PNG icon generator (no external deps) ─────────────────────────────────
   Generates gradient rounded-square icons for PWA installability.
   Chrome requires at least a 192×192 and 512×512 PNG to fire
   the beforeinstallprompt event.
───────────────────────────────────────────────────────────────────────────── */
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    let b = buf[i];
    for (let j = 0; j < 8; j++) { c = (c ^ b) & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; b >>= 1; }
  }
  return (c ^ -1) >>> 0;
}
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const crc = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function generateIcon(size) {
  const [r1,g1,b1] = [0x7c, 0x6a, 0xff]; // #7c6aff
  const [r2,g2,b2] = [0xff, 0x6a, 0x8a]; // #ff6a8a
  const radius = size * 0.22;
  const rowLen = 1 + size * 4;
  const raw = Buffer.alloc(size * rowLen, 0);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const t  = (x + y) / (2 * (size - 1));
      const R  = Math.round(r1 + t * (r2 - r1));
      const G  = Math.round(g1 + t * (g2 - g1));
      const B  = Math.round(b1 + t * (b2 - b1));
      const cx = x + 0.5, cy = y + 0.5;
      let alpha = 255;
      const corners = [[radius,radius],[size-radius,radius],[radius,size-radius],[size-radius,size-radius]];
      for (const [ox, oy] of corners) {
        if (cx < ox === ox < size/2 && cy < oy === oy < size/2) {
          const dx = cx - ox, dy = cy - oy;
          if (dx*dx + dy*dy > radius*radius) { alpha = 0; break; }
        }
      }
      const off = y * rowLen + 1 + x * 4;
      raw[off]=R; raw[off+1]=G; raw[off+2]=B; raw[off+3]=alpha;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
  ihdr[8]=8; ihdr[9]=6; // 8-bit RGBA
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  return Buffer.concat([sig, pngChunk('IHDR',ihdr), pngChunk('IDAT',zlib.deflateSync(raw,{level:9})), pngChunk('IEND',Buffer.alloc(0))]);
}
fs.mkdirSync('icons', { recursive: true });
[192, 512].forEach(size => {
  const path = `icons/icon-${size}.png`;
  fs.writeFileSync(path, generateIcon(size));
  console.log(`  ✅  Generated ${path}`);
});

const tokens = {
  '%%FIREBASE_API_KEY%%':             process.env.FIREBASE_API_KEY            || '',
  '%%FIREBASE_AUTH_DOMAIN%%':         process.env.FIREBASE_AUTH_DOMAIN        || '',
  '%%FIREBASE_PROJECT_ID%%':          process.env.FIREBASE_PROJECT_ID         || '',
  '%%FIREBASE_STORAGE_BUCKET%%':      process.env.FIREBASE_STORAGE_BUCKET     || '',
  '%%FIREBASE_MESSAGING_SENDER_ID%%': process.env.FIREBASE_MESSAGING_SENDER_ID|| '',
  '%%FIREBASE_APP_ID%%':              process.env.FIREBASE_APP_ID             || '',
};

const missing = Object.entries(tokens)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error('⚠️  Missing environment variables for:', missing.join(', '));
  console.error('   Create a .env file from .env.example and fill in your Firebase values.');
  process.exit(1);
}

let html = fs.readFileSync('index.html', 'utf8');
for (const [token, value] of Object.entries(tokens)) {
  html = html.replaceAll(token, value);
}

fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/index.html', html);

// Copy any static assets that exist alongside index.html
['sw.js', 'manifest.json', 'favicon.ico'].forEach(file => {
  if (fs.existsSync(file)) fs.copyFileSync(file, `public/${file}`);
});

// Copy icons/ folder recursively
if (fs.existsSync('icons')) {
  fs.mkdirSync('public/icons', { recursive: true });
  fs.readdirSync('icons').forEach(file => {
    fs.copyFileSync(`icons/${file}`, `public/icons/${file}`);
  });
}

console.log('✅  Build complete → public/index.html');
