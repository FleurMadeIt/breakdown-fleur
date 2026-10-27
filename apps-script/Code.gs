/**
 * Breakdown Fleur — relais Drive → GitHub.
 * Toutes les 5 min : cherche dans Drive/Breakdowns/_inbox les shots dont le shot.json
 * est en "status": "ready", les passe en "queued" et lance le rendu sur GitHub Actions.
 * Installation : voir INSTALL.md à la racine du repo.
 */

// ⬇️ Colle ta clé GitHub entre les guillemets, enregistre, puis lance setup.
const GITHUB_TOKEN = '';

// Optionnel : seulement si ta copie du repo ne s'appelle pas breakdown-fleur (ex. 'ton-compte/mon-repo').
const GITHUB_REPO = '';

function config_() {
  const p = PropertiesService.getScriptProperties();
  const cfg = {
    INBOX_ID: p.getProperty('INBOX_ID'),
    OUT_ID: p.getProperty('OUT_ID'),
    REPO: (GITHUB_REPO || p.getProperty('GITHUB_REPO') || '').trim(),
    TOKEN: (GITHUB_TOKEN || p.getProperty('GITHUB_TOKEN') || '').trim(),
  };
  if (!cfg.INBOX_ID || !cfg.OUT_ID) throw new Error('Lance setup une fois pour créer les dossiers Breakdowns.');
  return cfg;
}

function checkInbox() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const CONFIG = config_();
    const folders = DriveApp.getFolderById(CONFIG.INBOX_ID).getFolders();
    while (folders.hasNext()) {
      const folder = folders.next();
      try {
        ensurePreview_(folder);
      } catch (e) {
        console.warn('Aperçu impossible pour ' + folder.getName() + ' : ' + e.message);
      }
      const files = folder.getFilesByName('shot.json');
      if (!files.hasNext()) continue;
      const file = files.next();
      let cfg;
      try {
        cfg = JSON.parse(file.getBlob().getDataAsString());
      } catch (e) {
        continue;
      }
      if (cfg.status !== 'ready') continue;

      writeJson_(file, Object.assign(cfg, {status: 'queued', queuedAt: new Date().toISOString(), error: null}));
      try {
        dispatch_(CONFIG, folder, cfg);
        console.log('Rendu lancé : ' + folder.getName());
      } catch (e) {
        writeJson_(file, Object.assign(cfg, {status: 'error', error: String(e.message).slice(0, 400)}));
        console.error(e);
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function dispatch_(CONFIG, folder, cfg) {
  if (!CONFIG.REPO) throw new Error('Repo GitHub inconnu : relance setup');
  if (!CONFIG.TOKEN) throw new Error('Clé GitHub manquante : colle-la en haut du script puis relance setup');
  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + CONFIG.REPO + '/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + CONFIG.TOKEN, Accept: 'application/vnd.github+json'},
    payload: JSON.stringify({
      event_type: 'render-breakdown',
      client_payload: {
        folder_id: folder.getId(),
        shot_name: folder.getName(),
        out_folder_id: CONFIG.OUT_ID,
        // réglages figés au moment du lancement : le rendu ne dépend plus du shot.json resté dans Drive
        config: cfg,
        // jeton Drive temporaire (1 h) pour que GitHub télécharge le shot et dépose le MP4
        token: ScriptApp.getOAuthToken(),
      },
    }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 204) {
    throw new Error('GitHub ' + res.getResponseCode() + ' : ' + res.getContentText().slice(0, 300));
  }
}

/**
 * Dépose preview.jpg dans le dossier du shot : la vignette que Drive génère pour la couche finale
 * (marche aussi pour les vidéos lourdes ou en ProRes, que le navigateur ne sait pas lire).
 */
function ensurePreview_(folder) {
  if (folder.getFilesByName('preview.jpg').hasNext()) return;
  let best = null;
  let bestScore = -1;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    const m = /^(\d{1,3})[ _.-]+(.+?)\.[^.]+$/.exec(f.getName());
    if (!m || !/^(video|image)\//.test(f.getMimeType())) continue;
    const score = /^final$/i.test(m[2]) ? 1e6 : Number(m[1]);
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  if (!best) return;
  const auth = {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions: true};
  const meta = JSON.parse(
    UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + best.getId() + '?fields=thumbnailLink', auth).getContentText(),
  );
  if (!meta.thumbnailLink) return; // Drive n'a pas encore fini de traiter la vidéo : on réessaie au prochain passage
  const res = UrlFetchApp.fetch(meta.thumbnailLink.replace(/=s\d+$/, '=s1280'), auth);
  if (res.getResponseCode() !== 200) return;
  folder.createFile(res.getBlob().setName('preview.jpg'));
  console.log('Aperçu créé : ' + folder.getName());
}

function writeJson_(file, obj) {
  file.setContent(JSON.stringify(obj, null, 2));
}

function folderIn_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** Appel GitHub avec ta clé. */
function github_(token, path) {
  const res = UrlFetchApp.fetch('https://api.github.com' + path, {
    headers: {Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json'},
    muteHttpExceptions: true,
  });
  return {code: res.getResponseCode(), body: res.getResponseCode() === 200 ? JSON.parse(res.getContentText()) : null};
}

/**
 * À lancer une seule fois : vérifie la clé, retrouve ta copie du repo, crée Breakdowns/_inbox et _out
 * à la racine du Drive et le déclencheur toutes les 5 minutes.
 */
function setup() {
  const p = PropertiesService.getScriptProperties();
  const token = (GITHUB_TOKEN || p.getProperty('GITHUB_TOKEN') || '').trim();
  if (!token) throw new Error('Colle ta clé GitHub en haut du script (const GITHUB_TOKEN = \'…\'), enregistre, puis relance setup.');

  // le repo : celui indiqué, sinon <ton-compte>/breakdown-fleur
  let repo = (GITHUB_REPO || p.getProperty('GITHUB_REPO') || '').trim();
  if (!repo) {
    const me = github_(token, '/user');
    if (me.code !== 200) throw new Error('Clé GitHub refusée (' + me.code + ') : vérifie que tu l\'as copiée en entier.');
    repo = me.body.login + '/breakdown-fleur';
  }
  const check = github_(token, '/repos/' + repo);
  if (check.code !== 200) {
    throw new Error('Impossible d\'accéder à ' + repo + ' (' + check.code + '). Vérifie que la clé donne accès à ce repo, ' +
      'ou indique son nom exact dans GITHUB_REPO en haut du script.');
  }
  p.setProperty('GITHUB_REPO', repo);

  const root = folderIn_(DriveApp.getRootFolder(), 'Breakdowns');
  const inbox = folderIn_(root, '_inbox');
  const out = folderIn_(root, '_out');
  p.setProperty('INBOX_ID', inbox.getId());
  p.setProperty('OUT_ID', out.getId());

  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkInbox').timeBased().everyMinutes(5).create();

  console.log('✅ Tout est prêt. Repo : ' + repo + ' — dépose tes shots ici : ' + inbox.getUrl());
  checkInbox();
}
