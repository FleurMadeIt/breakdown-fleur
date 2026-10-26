// Copie les polices depuis node_modules vers public/fonts (lancé automatiquement après npm install)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dst = path.join(ROOT, 'public', 'fonts');
fs.mkdirSync(dst, {recursive: true});
const files = [
  ['@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'inter-variable.woff2'],
  ['@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2', 'jetbrains-mono-latin-500-normal.woff2'],
];
for (const [src, name] of files) fs.copyFileSync(path.join(ROOT, 'node_modules', src), path.join(dst, name));
console.log('✓ polices copiées dans public/fonts');
