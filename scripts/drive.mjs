#!/usr/bin/env node
// Échanges avec Google Drive pendant le rendu automatique (GitHub Actions).
// Le jeton d'accès vient d'Apps Script (ScriptApp.getOAuthToken), valable 1 h, jamais stocké.
//
//   node scripts/drive.mjs fetch   <folderId> <dossierLocal>
//   node scripts/drive.mjs publish <folderId> <outFolderId> <fichier.mp4>
//   node scripts/drive.mjs fail    <folderId> <message>
//
// Variable d'environnement requise : DRIVE_TOKEN

import fs from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const TOKEN = process.env.DRIVE_TOKEN;
if (!TOKEN) {
  console.error('DRIVE_TOKEN manquant');
  process.exit(1);
}
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const auth = {Authorization: `Bearer ${TOKEN}`};

async function api(url, opts = {}) {
  const r = await fetch(url, {...opts, headers: {...auth, ...(opts.headers ?? {})}});
  if (!r.ok) throw new Error(`Drive ${r.status} ${url}\n${await r.text()}`);
  return r;
}

async function list(folderId) {
  const out = [];
  let pageToken = '';
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const r = await api(
      `${API}/files?q=${q}&fields=nextPageToken,files(id,name,mimeType,size)&pageSize=1000&pageToken=${pageToken}`,
    );
    const j = await r.json();
    out.push(...j.files);
    pageToken = j.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

async function download(file, dst) {
  const r = await api(`${API}/files/${file.id}?alt=media`);
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(dst));
}

async function fetchFolder(folderId, localDir) {
  fs.mkdirSync(localDir, {recursive: true});
  for (const f of await list(folderId)) {
    const dst = path.join(localDir, f.name);
    if (f.mimeType === FOLDER) {
      await fetchFolder(f.id, dst); // séquence d'images
    } else if (!f.mimeType.startsWith('application/vnd.google-apps')) {
      process.stdout.write(`  ↓ ${f.name} (${((Number(f.size) || 0) / 1e6).toFixed(1)} Mo)\n`);
      await download(f, dst);
    }
  }
}

async function findShotJson(folderId) {
  return (await list(folderId)).find((f) => f.name === 'shot.json');
}

async function setStatus(folderId, patch) {
  const existing = await findShotJson(folderId);
  let cfg = {};
  if (existing) {
    try {
      cfg = await (await api(`${API}/files/${existing.id}?alt=media`)).json();
    } catch {
      cfg = {};
    }
  }
  const body = JSON.stringify({...cfg, ...patch, updatedAt: new Date().toISOString()}, null, 2);
  if (existing) {
    await api(`${UPLOAD}/files/${existing.id}?uploadType=media`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body,
    });
  } else {
    await uploadSmall(folderId, 'shot.json', 'application/json', Buffer.from(body));
  }
}

async function uploadSmall(parentId, name, mime, buf) {
  const boundary = 'fleur' + Date.now();
  const meta = JSON.stringify({name, parents: [parentId]});
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
    buf,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const r = await api(`${UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`, {
    method: 'POST',
    headers: {'Content-Type': `multipart/related; boundary=${boundary}`},
    body,
  });
  return r.json();
}

// upload "resumable" : pas de limite de 5 Mo comme le multipart
async function uploadLarge(parentId, name, mime, file) {
  const init = await api(`${UPLOAD}/files?uploadType=resumable&fields=id,webViewLink`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime},
    body: JSON.stringify({name, parents: [parentId]}),
  });
  const session = init.headers.get('location');
  const buf = fs.readFileSync(file);
  const r = await fetch(session, {method: 'PUT', headers: {'Content-Type': mime}, body: buf});
  if (!r.ok) throw new Error(`Upload ${r.status}\n${await r.text()}`);
  return r.json();
}

const [cmd, ...args] = process.argv.slice(2);
try {
  if (cmd === 'fetch') {
    const [folderId, localDir] = args;
    await fetchFolder(folderId, localDir);
  } else if (cmd === 'publish') {
    const [folderId, outFolderId, file] = args;
    const up = await uploadLarge(outFolderId, path.basename(file), 'video/mp4', file);
    console.log(`  ↑ ${path.basename(file)} → ${up.webViewLink}`);
    await setStatus(folderId, {status: 'done', outputId: up.id, outputUrl: up.webViewLink, error: null});
    // sources à la corbeille (vidée automatiquement par Drive après 30 jours)
    await api(`${API}/files/${folderId}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({trashed: true}),
    });
    console.log('  ✓ sources déplacées dans la corbeille Drive');
  } else if (cmd === 'fail') {
    const [folderId, message] = args;
    await setStatus(folderId, {status: 'error', error: String(message).slice(0, 500)});
  } else {
    throw new Error(`Commande inconnue : ${cmd}`);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
