/**
 * Breakdown Fleur — relais Drive → GitHub.
 * Toutes les 5 min : cherche dans Drive/Breakdowns/_inbox les shots dont le shot.json
 * est en "status": "ready", les passe en "queued" et lance le rendu sur GitHub Actions.
 *
 * Installation : voir apps-script/INSTALL.md
 */
const CONFIG = {
  INBOX_ID: '1f6HDDYW2pP95lgJZu0y_yie2a4PllufX', // Drive/Breakdowns/_inbox
  OUT_ID: '1pawuvOdhSTmfkCtPT5wlqkUSrHa7kgfz', // Drive/Breakdowns/_out
  REPO: 'FleurMadeIt/breakdown-fleur',
};

function checkInbox() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const folders = DriveApp.getFolderById(CONFIG.INBOX_ID).getFolders();
    while (folders.hasNext()) {
      const folder = folders.next();
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
        dispatch_(folder);
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

function dispatch_(folder) {
  const gh = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!gh) throw new Error('GITHUB_TOKEN manquant dans les propriétés du script');
  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + CONFIG.REPO + '/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + gh, Accept: 'application/vnd.github+json'},
    payload: JSON.stringify({
      event_type: 'render-breakdown',
      client_payload: {
        folder_id: folder.getId(),
        shot_name: folder.getName(),
        out_folder_id: CONFIG.OUT_ID,
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

function writeJson_(file, obj) {
  file.setContent(JSON.stringify(obj, null, 2));
}

/** À lancer une seule fois : crée le déclencheur toutes les 5 minutes. */
function setup() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkInbox').timeBased().everyMinutes(5).create();
  checkInbox();
}
