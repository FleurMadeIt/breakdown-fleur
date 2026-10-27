#!/usr/bin/env node
// Génère des couches de test (plate, wire, light, final) dans un dossier de shot vide.
// Sert au test de bout en bout : un dossier Drive qui ne contient qu'un shot.json avec "test": true.
//   node scripts/make-test.mjs <dossier>
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) process.exit(1);
fs.mkdirSync(dir, {recursive: true});
const box = "x='560+500*sin(t*1.2)':y='340+120*cos(t*0.9)':w=420:h=420";
const grad = 'gradients=s=1920x1080:c0=0x2a3440:c1=0x9a8366:speed=0.03:d=6:r=25';
const layers = [
  ['01_plate.mp4', grad, 'noise=alls=14:allf=t'],
  ['02_wire.mp4', 'color=c=0x101114:s=1920x1080:d=6:r=25', `drawgrid=w=96:h=96:t=1:c=0x5e6ad2@0.5,drawbox=${box}:t=4:c=white`],
  ['03_light.mp4', 'color=c=black:s=1920x1080:d=6:r=25', `drawbox=${box}:t=fill:c=0xc9cfd8`],
  ['99_final.mp4', grad, `noise=alls=14:allf=t,drawbox=${box}:t=fill:c=0xff6a3d`],
];
for (const [name, src, vf] of layers) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', src, '-vf', vf, '-pix_fmt', 'yuv420p', path.join(dir, name)]);
  console.log(`  ✓ ${name}`);
}
