// Fügt src/* zu einer einzigen, selbstständigen dist/index.html zusammen (CSS und JS inline).
//   node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(root, 'src', f), 'utf8');

// Reihenfolge ist wichtig: config → texts → rules → state → game
const JS_FILES = ['config.js', 'texts.js', 'rules.js', 'state.js', 'game.js'];

const css = src('styles.css');
const js = JS_FILES.map((f) => `// ===== ${f} =====\n${src(f)}`).join('\n');

if (/<\/script/i.test(js)) throw new Error('Quellcode enthält "</script" – würde das Inline-Skript beenden.');
if (/<\/style/i.test(css)) throw new Error('CSS enthält "</style".');

const html = src('template.html')
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => js);

if (html.includes('/*__CSS__*/') || html.includes('/*__JS__*/')) throw new Error('Platzhalter nicht ersetzt.');

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'index.html'), html, 'utf8');
console.log(`dist/index.html geschrieben (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
