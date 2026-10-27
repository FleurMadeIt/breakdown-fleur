#!/usr/bin/env node
// Prépare + rend un breakdown en une commande.
//   node scripts/render.mjs <dossier-du-shot> [dossier-de-sortie]
// Sortie par défaut : out/<shot>_breakdown.mp4

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [shotDir, outArg] = process.argv.slice(2);
if (!shotDir) {
  console.error('Usage : node scripts/render.mjs <dossier-du-shot> [dossier-de-sortie]');
  process.exit(1);
}

execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'prep.mjs'), shotDir], {stdio: 'inherit'});

// même règle de nommage que prep.mjs
const name = path
  .basename(path.resolve(shotDir))
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9_-]+/g, '_')
  .toLowerCase();
const slug = path.join(ROOT, 'shots', `${name}.json`);
const props = JSON.parse(fs.readFileSync(slug, 'utf8'));

const outDir = path.resolve(outArg ?? path.join(ROOT, 'out'));
fs.mkdirSync(outDir, {recursive: true});

// "both" : deux rendus, un fit et un crop, à partir des mêmes couches préparées
const variants = props.framing === 'both' ? ['fit', 'crop'] : [props.framing];
for (const v of variants) {
  const vProps = path.join(ROOT, 'shots', `${name}.${v}.json`);
  fs.writeFileSync(vProps, JSON.stringify({...props, framing: v}, null, 2));
  const outFile = path.join(outDir, variants.length > 1 ? `${props.shotName}_${v}_breakdown.mp4` : `${props.shotName}_breakdown.mp4`);
  const args = [
    'remotion', 'render', 'src/index.ts', 'Breakdown', outFile,
    `--props=${vProps}`, '--codec=h264', '--crf=16', '--image-format=jpeg', '--jpeg-quality=95',
  ];
  if (process.env.REMOTION_BROWSER) args.push(`--browser-executable=${process.env.REMOTION_BROWSER}`);
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {stdio: 'inherit', cwd: ROOT, shell: process.platform === 'win32'});
  console.log(`\n\u2713 Breakdown (${v}) : ${outFile}`);
}
