# Breakdown Fleur

Génère un breakdown VFX avant/après en 9:16 (1080×1920), toujours dans le même style (design system Linear, comme Devis Fleur).

FINAL (accroche) → wipe → PLATE → wipe → passes… → wipe → FINAL (la vidéo boucle).

## 1. Préparer un shot

Un dossier par shot, couches numérotées dans l'ordre d'apparition :

```
vega_sh010/
  01_plate.mov
  02_wire.mp4
  03_light/            ← séquence d'images (PNG, JPG, EXR, TIFF, DPX)
  99_final.mp4         ← la couche "final" passe toujours en dernier
  shot.json            ← facultatif
```

Le texte après le numéro devient le label (`02_wire` → WIRE). Pour un autre label, utilise `labels` dans `shot.json`.

### shot.json (tous les champs sont facultatifs)

| Champ | Valeurs | Défaut |
|---|---|---|
| `title` | texte affiché en haut, ex. « Vega — sh010 » | vide |
| `framing` | `fit` (shot entier dans une carte) ou `crop` (plein écran recadré) | `fit` |
| `cropX` | position du recadrage, 0 = gauche, 0.5 = centre, 1 = droite | `0.5` |
| `labels` | `{ "02": "WIREFRAME" }` | nom du fichier |
| `start` / `duration` | portion du plan à utiliser, en secondes (15 s max) | `0` / `15` |
| `sequenceFps` | cadence des séquences d'images | `25` |
| `status` | `draft` ou `ready` (posé par la page Breakdown Fleur) | `draft` |

Exemple complet : `shot.example.json`.

## 2. Réglages d'export conseillés

Seule la partie utile du plan sert, toutes les couches doivent avoir **la même durée et le même point de départ**. Garde ProRes et EXR sur le Shadow : le script les convertit, mais des MP4 légers passent bien mieux par Drive.

| Logiciel | Réglage |
|---|---|
| **Nuke** | Write node : `mov`, codec H.264, qualité haute, même `first/last frame` pour chaque couche |
| **After Effects** | File d'attente Media Encoder : H.264, débit 20 Mbit/s, résolution native |
| **DaVinci Resolve** | Deliver → H.264, qualité « Best », plage In/Out identique pour chaque couche |
| **Blender** | Sortie FFmpeg, MPEG-4 / H.264, qualité « High » (ou séquence PNG) |

Taille visée : moins de 20 Mo par couche, moins de 150 Mo par shot. Le script refuse toute couche de plus de 2 Go.

## 3. Rendre

```bash
npm install
npm run render -- /chemin/vers/vega_sh010     # → out/vega_sh010_breakdown.mp4
npm run studio                                 # aperçu en direct dans le navigateur
```

`prep.mjs` normalise toutes les couches (30 fps, H.264, sans son, même résolution), puis Remotion fait le rendu.
Il faut Node 18+ et ffmpeg/ffprobe dans le PATH.

## Où se règle le style

- `src/theme.ts` : couleurs, typo, rayons, durées du wipe et des couches
- `src/Breakdown.tsx` : mise en page fit / crop, labels, wipe
- `src/timeline.ts` : enchaînement des couches et durée totale (visée ~13 s)
