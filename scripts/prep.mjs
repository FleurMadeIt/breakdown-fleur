#!/usr/bin/env node
// Prépare un dossier de shot pour le rendu.
//   node scripts/prep.mjs <dossier-du-shot>
//
// Le dossier contient des couches numérotées :
//   01_plate.mov   02_wire.mp4   03_light/ (séquence PNG/EXR/JPG/TIFF)   99_final.mp4
// et, en option, un shot.json :
//   { "title": "", "framing": "fit" | "crop", "cropX": 0.5,
//     "labels": { "02": "WIREFRAME" }, "start": 0, "duration": 6, "sequenceFps": 25 }
//
// Sortie : public/shots/<slug>/NN_label.mp4 (H.264, 30 fps, sans son) + shots/<slug>.json (props Remotion)

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30;
const MAX_SECONDS = 15;
const MAX_LAYER_BYTES = 2 * 1024 ** 3; // garde-fou : 2 Go par couche
const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm|avi|mxf)$/i;
const IMAGE_EXT = /\.(png|jpe?g|exr|tiff?|dpx)$/i;
const NAME_RE = /^(\d{1,3})[ _.-]+(.+?)$/;

const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const run = (cmd, args) => execFileSync(cmd, args, {stdio: ['ignore', 'pipe', 'pipe']}).toString();

const shotDir = process.argv[2] && path.resolve(process.argv[2]);
if (!shotDir || !fs.existsSync(shotDir) || !fs.statSync(shotDir).isDirectory()) {
  die('Usage : node scripts/prep.mjs <dossier-du-shot>');
}

const slug = path
  .basename(shotDir)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9_-]+/g, '_')
  .toLowerCase();

const cfgPath = path.join(shotDir, 'shot.json');
const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};
const framing = cfg.framing === 'crop' ? 'crop' : 'fit';
const cropX = Math.min(1, Math.max(0, Number(cfg.cropX ?? 0.5)));
const start = Math.max(0, Number(cfg.start ?? 0));
const duration = Math.min(MAX_SECONDS, Number(cfg.duration ?? MAX_SECONDS));
const seqFps = Number(cfg.sequenceFps ?? 25);

// ---- 1. repérage des couches
const entries = fs
  .readdirSync(shotDir, {withFileTypes: true})
  .filter((e) => !e.name.startsWith('.') && e.name !== 'shot.json');

const layers = [];
for (const e of entries) {
  const base = e.isDirectory() ? e.name : e.name.replace(/\.[^.]+$/, '');
  const m = NAME_RE.exec(base);
  if (!m) {
    console.warn(`  · ignoré (pas de numéro devant) : ${e.name}`);
    continue;
  }
  const full = path.join(shotDir, e.name);
  if (e.isDirectory()) {
    const frames = fs.readdirSync(full).filter((f) => IMAGE_EXT.test(f)).sort();
    if (!frames.length) {
      console.warn(`  · ignoré (dossier sans images) : ${e.name}`);
      continue;
    }
    layers.push({num: m[1], key: m[2], kind: 'seq', path: full, frames});
  } else if (VIDEO_EXT.test(e.name) || IMAGE_EXT.test(e.name)) {
    const size = fs.statSync(full).size;
    if (size > MAX_LAYER_BYTES) die(`${e.name} pèse ${(size / 1024 ** 3).toFixed(1)} Go. Exporte une version coupée (≤ 15 s) avant.`);
    layers.push({num: m[1], key: m[2], kind: VIDEO_EXT.test(e.name) ? 'video' : 'still', path: full});
  } else {
    console.warn(`  · ignoré (format inconnu) : ${e.name}`);
  }
}
if (layers.length < 2) die('Il faut au moins 2 couches (ex. 01_plate et 99_final).');

layers.sort((a, b) => Number(a.num) - Number(b.num));
// la couche "final" passe en dernier même si elle n'a pas le plus grand numéro
const fi = layers.findIndex((l) => /^final$/i.test(l.key));
if (fi >= 0 && fi !== layers.length - 1) layers.push(layers.splice(fi, 1)[0]);

// ---- 2. résolution cible, d'après la couche finale
const probe = (args) => JSON.parse(run('ffprobe', ['-v', 'error', '-print_format', 'json', ...args]));
const finalL = layers[layers.length - 1];
const probeTarget = finalL.kind === 'seq' ? path.join(finalL.path, finalL.frames[0]) : finalL.path;
const st = probe(['-select_streams', 'v:0', '-show_entries', 'stream=width,height', probeTarget]).streams?.[0];
if (!st) die(`Impossible de lire ${probeTarget}`);
const even = (n) => Math.max(2, Math.round(n / 2) * 2);
// fit : cadre de 1000 px de large → 1280 suffit. crop : on garde jusqu'à 1920 px de haut pour rester net.
let W, H;
if (framing === 'fit') {
  W = even(Math.min(st.width, 1280));
  H = even((W * st.height) / st.width);
} else {
  H = even(Math.min(st.height, 1920));
  W = even((H * st.width) / st.height);
}

// ---- 3. normalisation ffmpeg
const outDir = path.join(ROOT, 'public', 'shots', slug);
fs.rmSync(outDir, {recursive: true, force: true});
fs.mkdirSync(outDir, {recursive: true});

const out = [];
for (const l of layers) {
  const label = String(cfg.labels?.[l.num] ?? l.key.replace(/[_-]+/g, ' ')).toUpperCase();
  const file = `${l.num.padStart(2, '0')}_${l.key.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.mp4`;
  const dst = path.join(outDir, file);
  const isExr = l.kind === 'seq' ? /\.exr$/i.test(l.frames[0]) : /\.exr$/i.test(l.path);

  const input = [];
  if (isExr) input.push('-apply_trc', 'iec61966_2_1'); // EXR linéaire → sRGB
  if (l.kind === 'seq') {
    // liste concat : marche aussi sous Windows (pas de glob)
    const list = path.join(outDir, `${file}.txt`);
    const step = 1 / seqFps;
    fs.writeFileSync(
      list,
      l.frames.map((f) => `file '${path.join(l.path, f).replace(/'/g, "'\\''")}'\nduration ${step}`).join('\n') +
        `\nfile '${path.join(l.path, l.frames.at(-1)).replace(/'/g, "'\\''")}'\n`,
    );
    input.push('-f', 'concat', '-safe', '0', '-i', list);
  } else if (l.kind === 'still') {
    input.push('-loop', '1', '-t', String(duration), '-i', l.path);
  } else {
    input.push('-ss', String(start), '-t', String(duration), '-i', l.path);
  }

  const vf = `fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},format=yuv420p`;
  process.stdout.write(`  → ${label.padEnd(14)} ${path.basename(l.path)} `);
  try {
    run('ffmpeg', [
      '-y', '-v', 'error', ...input,
      '-t', String(duration), '-an', '-vf', vf,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-movflags', '+faststart', dst,
    ]);
  } catch (err) {
    console.log('');
    die(`ffmpeg a échoué sur ${l.path}\n${err.stderr?.toString() ?? err.message}`);
  }
  if (l.kind === 'seq') fs.rmSync(path.join(outDir, `${file}.txt`), {force: true});

  const frames = Number(
    probe(['-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', dst]).streams[0]
      .nb_read_packets,
  );
  console.log(`${frames} f`);
  out.push({src: `shots/${slug}/${file}`, label, durationInFrames: frames, width: W, height: H});
}

const props = {
  shotName: slug,
  title: cfg.title ?? '',
  framing,
  cropX,
  layers: out,
  loopFrames: Math.min(...out.map((l) => l.durationInFrames)),
};
fs.mkdirSync(path.join(ROOT, 'shots'), {recursive: true});
const propsPath = path.join(ROOT, 'shots', `${slug}.json`);
fs.writeFileSync(propsPath, JSON.stringify(props, null, 2));
console.log(`✓ ${out.length} couches prêtes · ${framing}${framing === 'crop' ? ` (cropX ${cropX})` : ''} · ${W}×${H}`);
console.log(`  props : ${path.relative(ROOT, propsPath)}`);
