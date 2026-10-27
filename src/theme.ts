// Design system : Linear (Open Design, design-systems/linear-app/DESIGN.md),
// le même que Devis Fleur. Modifier ici change le style de TOUS les breakdowns.
export const theme = {
  // surfaces : profondeur par paliers de luminance, pas par ombres
  bg: '#08090a',
  panel: '#0f1011',
  elevated: '#191a1b',
  // texte
  fg: '#f7f8f8',
  fg2: '#d0d6e0',
  muted: '#8a8f98',
  meta: '#62666d',
  // bordures fines semi-transparentes
  borderSubtle: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.08)',
  borderPill: '#23252a',
  // seule couleur : l'indigo, réservé à l'état actif
  accent: '#5e6ad2',
  accentBright: '#7170ff',
  font: '"Inter", system-ui, sans-serif',
  fontFeatures: '"cv01", "ss03"',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  // 400 lecture · 510 emphase (signature Linear) · 590 annonce. Jamais de 700.
  weight: {read: 400, ui: 510, strong: 590},
  radius: {btn: 6, card: 8, panel: 12, large: 22, pill: 9999},
} as const;

// Format et zones protégées Instagram Reels (1080×1920).
// Tout le texte reste dans la zone sûre : 250 px en haut, 420 px en bas, 70 px à gauche,
// 55 px à droite en haut et 193 px à droite sous y = 1110 (colonne like / commentaire / partage).
export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
  safeTop: 250,
  safeBottom: 420,
  safeLeft: 70,
  safeRight: 55,
  safeRightLow: 193,
  lowZoneStart: 1110,
} as const;

export const TIMING = {
  wipe: 16, // durée d'un wipe en frames (~530 ms)
  labelSwap: 9, // changement du grand label (~300 ms)
  firstHold: 60, // FINAL d'ouverture (accroche) : 2 s
  lastHold: 45, // FINAL de fin, raccord avec le début pour la boucle
  minHold: 30, // durée mini par couche intermédiaire : 1 s
  maxHold: 70, // durée maxi par couche intermédiaire : ~2,3 s
  targetTotal: 13 * 30, // durée visée : ~13 s
} as const;

// Easing standard cubic-bezier(.2,0,0,1) : rapide au départ, se pose net
export const EASE: [number, number, number, number] = [0.2, 0, 0, 1];
