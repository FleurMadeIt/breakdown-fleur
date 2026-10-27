# Installer Breakdown Fleur chez toi

Tu déposes les couches d'un shot dans un dossier Google Drive, et tu récupères 5 à 10 minutes plus tard un breakdown avant/après en 9:16, prêt pour Instagram (version fit, crop, ou les deux).

Tout tourne sur **tes** comptes, gratuitement : ton Google Drive, ta copie du repo sur GitHub. Personne d'autre ne voit tes shots. Compte environ 15 minutes.

Il te faut :
- un compte **GitHub** (gratuit) ;
- un compte **Google** (Drive) ;
- en option, un compte **claude.ai** avec le connecteur Google Drive, pour utiliser la page de réglage. Sans, l'outil marche aussi (voir l'étape 5).

---

## 1. Copier le repo

1. Ouvre [github.com/FleurMadeIt/breakdown-fleur](https://github.com/FleurMadeIt/breakdown-fleur) et clique **Use this template → Create a new repository**.
2. Nom : `breakdown-fleur`. Laisse-le en **Public** : GitHub offre alors les minutes de rendu sans limite. Aucun secret n'est stocké dans le repo.
3. Dans ta copie, onglet **Actions** : si GitHub demande d'activer les workflows, clique **I understand… enable them**.

Note le nom complet de ta copie, du type `ton-compte/breakdown-fleur`.

## 2. Créer ta clé GitHub

1. Va sur [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
2. **Token name** : `breakdown-fleur-apps-script`. **Expiration** : la plus longue proposée.
3. **Repository access** : *Only select repositories* → ta copie `breakdown-fleur`.
4. **Permissions** → *Repositories* → **Contents** : **Read and write**. Rien d'autre.
5. **Generate token**, puis copie la clé (`github_pat_…`). Elle ne s'affiche qu'une fois. Ne la colle nulle part ailleurs qu'à l'étape 3.

## 3. Installer le relais Google (Apps Script)

1. Va sur [script.google.com](https://script.google.com) → **Nouveau projet**. Renomme-le `Breakdown Fleur — relais`.
2. Efface le contenu de `Code.gs` et colle à la place tout le fichier [`apps-script/Code.gs`](apps-script/Code.gs) de ta copie. Enregistre (Ctrl/Cmd + S).
3. ⚙️ **Paramètres du projet** → **Propriétés du script** → ajoute :
   - `GITHUB_REPO` = `ton-compte/breakdown-fleur`
   - `GITHUB_TOKEN` = ta clé de l'étape 2
   puis **Enregistrer les propriétés de script**.
4. Retour à l'éditeur : choisis la fonction **`setup`** et clique **Exécuter**.
5. Google demande une autorisation : **Examiner les autorisations** → ton compte → *Paramètres avancés* → **Accéder à Breakdown Fleur — relais (non sécurisé)** → **Autoriser**. C'est ton propre script, pas une appli publique, d'où l'avertissement.

`setup` crée dans ton Drive le dossier **Breakdowns**, avec `_inbox` (là où tu déposes) et `_out` (là où arrivent les MP4), puis vérifie les dépôts toutes les 5 minutes.

## 4. Préparer un shot

Dans `Breakdowns/_inbox`, crée un dossier par shot avec les couches numérotées dans l'ordre :

```
vega_sh010/
  01_plate.mov
  02_wire.mp4
  03_light/        ← séquence d'images (PNG, JPG, TIFF, DPX)
  99_final.mov     ← la couche « final » passe toujours en dernier
```

Le texte après le numéro devient le label (`02_wire` → WIRE). Le ProRes passe très bien, le rendu le convertit.

## 5. Lancer le rendu

**Avec la page de réglage (claude.ai)** : ouvre la [page Breakdown Fleur](https://claude.ai/artifact/TKygS8YucC5dMoRBJcvxvN). Elle retrouve ton dossier Breakdowns toute seule (autorise Google Drive la première fois). Choisis le shot, règle fit / crop / les deux, le recadrage, le titre, puis **Lancer le rendu**.

**Sans la page** : dépose dans le dossier du shot un fichier `shot.json` :

```json
{ "title": "Vega — sh010", "framing": "both", "cropX": 0.5, "duration": 10, "status": "ready" }
```

`framing` : `fit`, `crop` ou `both`. `cropX` : position du recadrage, de 0 (gauche) à 1 (droite). Tous les réglages sont détaillés dans le [README](README.md).

Dans les 5 minutes, le rendu part sur GitHub (onglet **Actions** de ta copie). Le ou les MP4 arrivent dans `Breakdowns/_out`, et les sources du shot partent à la corbeille Drive.

## En cas de souci

- **Le shot passe en « Erreur »** : le message est dans son `shot.json` (champ `error`), et le détail dans l'onglet **Actions** de ta copie.
- **`GitHub 404`** : la clé n'a pas accès à ta copie, ou `GITHUB_REPO` est mal écrit. Vérifie l'étape 2 (repository + Contents en lecture/écriture).
- **Rien ne se passe** : dans Apps Script, menu ⏰ **Déclencheurs**, il doit y avoir `checkInbox` toutes les 5 minutes. Sinon, relance `setup`.
- **Changer le style** (couleurs, typo, durées) : `src/theme.ts` dans ta copie.
