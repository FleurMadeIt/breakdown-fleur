/**
 * Breakdown Fleur — relais Drive → GitHub.
 * Toutes les 5 min : cherche dans Drive/Breakdowns/_inbox les shots dont le shot.json
 * est en "status": "ready", les passe en "queued" et lance le rendu sur GitHub Actions.
 *
 * Installation : voir INSTALL.md à la racine du repo.
 * Propriétés du script à renseigner (⚙️ Paramètres du projet → Propriétés du script) :
 *   GITHUB_REPO   ton-compte/breakdown-fleur
 *   GITHUB_TOKEN  github_pat_…  (accès à ce repo, permission Contents en lecture/écriture)
 * Les propriétés INBOX_ID et OUT_ID sont remplies toutes seules par setup().
 */

function config_() {
  const p = PropertiesService.getScriptProperties();
  const cfg = {
    INBOX_ID: p.getProperty('INBOX_ID'),
    OUT_ID: p.getProperty('OUT_ID'),
    REPO: (p.getProperty('GITHUB_REPO') || '').trim(),
    TOKEN: (p.getProperty('GITHUB_TOKEN') || '').trim(),
  };
  if (!cfg.INBOX_ID || !cfg.OUT_ID) throw new Error('Lance setup() une fois pour créer les dossiers Breakdowns.');
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
  if (!CONFIG.REPO) throw new Error('GITHUB_REPO manquant dans les propriétés du script (ex. ton-compte/breakdown-fleur)');
  if (!CONFIG.TOKEN) throw new Error('GITHUB_TOKEN manquant dans les propriétés du script');
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

/**
 * À lancer une seule fois : crée (ou retrouve) Breakdowns/_inbox et _out à la racine du Drive,
 * enregistre leurs identifiants et crée le déclencheur toutes les 5 minutes.
 */
function setup() {
  const root = folderIn_(DriveApp.getRootFolder(), 'Breakdowns');
  const inbox = folderIn_(root, '_inbox');
  const out = folderIn_(root, '_out');
  const p = PropertiesService.getScriptProperties();
  p.setProperty('INBOX_ID', inbox.getId());
  p.setProperty('OUT_ID', out.getId());

  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkInbox').timeBased().everyMinutes(5).create();

  console.log('Dossier prêt : ' + root.getUrl());
  if (!p.getProperty('GITHUB_REPO')) console.warn('Ajoute la propriété GITHUB_REPO (ex. ton-compte/breakdown-fleur).');
  if (!p.getProperty('GITHUB_TOKEN')) console.warn('Ajoute la propriété GITHUB_TOKEN (ta clé GitHub).');
  checkInbox();
}
