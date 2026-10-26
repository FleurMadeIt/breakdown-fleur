export type Framing = 'fit' | 'crop';

export type Layer = {
  /** Chemin relatif à public/, ex. "shots/vega_sh010/01_plate.mp4" */
  src: string;
  /** Texte affiché, ex. "PLATE" */
  label: string;
  durationInFrames: number;
  width: number;
  height: number;
};

export type ShotProps = {
  shotName: string;
  /** Titre optionnel affiché en haut (vide = rien) */
  title?: string;
  /** fit = shot entier dans un cadre, crop = plein écran recadré */
  framing: Framing;
  /** Position horizontale du crop, 0 = gauche, 0.5 = centre, 1 = droite */
  cropX: number;
  /** Couches dans l'ordre : plate, passes..., final en dernier */
  layers: Layer[];
  /** Longueur commune de lecture (la plus courte des couches), en frames */
  loopFrames: number;
};
