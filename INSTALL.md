# Installer Breakdown Fleur chez toi

Tu déposes les couches d'un shot dans Google Drive et, 5 à 10 minutes plus tard, tu récupères un breakdown avant/après en 9:16 prêt pour Instagram. C'est gratuit, tout tourne sur tes comptes (Google + GitHub), et personne d'autre ne voit tes shots.

L'installation prend 3 étapes, environ 5 minutes.

## 1. Copie le repo

Clique **[Use this template → Create a new repository](https://github.com/new?template_name=breakdown-fleur&template_owner=FleurMadeIt)**. Laisse le nom `breakdown-fleur` et coche **Public**, puis clique **Create repository**.

## 2. Crée ta clé GitHub

Ouvre **[ce lien](https://github.com/settings/personal-access-tokens/new?name=breakdown-fleur&description=Relais%20Breakdown%20Fleur&expires_in=366&contents=write)**. Tout est déjà rempli, sauf une chose : sous **Repository access**, choisis *Only select repositories* puis `breakdown-fleur`.

Clique **Generate token** et copie la clé (`github_pat_…`).

## 3. Installe le relais Google

1. Ouvre [script.google.com](https://script.google.com) et clique **Nouveau projet**.
2. Efface tout, puis colle le contenu de [ce fichier](https://raw.githubusercontent.com/FleurMadeIt/breakdown-fleur/main/apps-script/Code.gs) (Ctrl/Cmd + A, puis copier).
3. Tout en haut, colle ta clé entre les guillemets : `const GITHUB_TOKEN = 'github_pat_…';`
4. Enregistre (Ctrl/Cmd + S), vérifie que **setup** est sélectionné dans la barre du haut, puis clique **Exécuter**.
5. Google demande l'autorisation. Clique **Examiner les autorisations**, choisis ton compte, puis *Paramètres avancés* → **Accéder au projet (non sécurisé)** → **Autoriser**. L'avertissement s'affiche parce que c'est ton propre script et pas une appli publique.

Quand le journal affiche **✅ Tout est prêt**, c'est terminé. Un dossier **Breakdowns** est apparu dans ton Drive.

---

## Utiliser l'outil

**1. Dépose un shot.** Dans `Breakdowns/_inbox`, crée un dossier par shot avec les couches numérotées :

```
vega_sh010/
  01_plate.mov
  02_wire.mp4
  03_light/        ← séquence d'images (PNG, JPG, TIFF, DPX)
  99_final.mov     ← la couche « final » passe toujours en dernier
```

Le texte après le numéro sert de label (`02_wire` devient WIRE). Le ProRes est accepté.

**2. Lance le rendu.** Ouvre la [page Breakdown Fleur](https://claude.ai/artifact/TKygS8YucC5dMoRBJcvxvN) (il faut un compte claude.ai avec Google Drive connecté). Elle retrouve ton dossier toute seule. Choisis le shot, règle fit / crop / les deux, puis clique **Lancer le rendu**.

Sans claude.ai, dépose plutôt dans le dossier du shot un fichier `shot.json` qui contient :

```json
{ "title": "Vega — sh010", "framing": "both", "cropX": 0.5, "status": "ready" }
```

**3. Récupère le MP4** dans `Breakdowns/_out`, 5 à 10 minutes plus tard. Les sources du shot partent alors à la corbeille Drive.

## En cas de souci

- **setup affiche une erreur** : le message dit quoi corriger, en général une clé mal copiée ou le repo pas coché à l'étape 2.
- **Le shot passe en « Erreur »** : le détail est dans l'onglet **Actions** de ton repo.
- **Rien ne se passe** : relance **setup** dans Apps Script.
