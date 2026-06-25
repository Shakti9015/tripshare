// build.js — injects env vars into index.html and writes to public/
// Locally:  copy .env.example → .env, fill in values, then run: node build.js
// On Vercel: runs automatically via vercel.json buildCommand

require('dotenv').config();
const fs = require('fs');

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
