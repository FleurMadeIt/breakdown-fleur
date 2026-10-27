import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Loop,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {buildTimeline} from './timeline';
import {EASE, theme, TIMING, VIDEO} from './theme';
import type {Layer, ShotProps} from './types';

const ease = Easing.bezier(...EASE);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const pad = (n: number) => String(n).padStart(2, '0');

/** "WIREFRAME" → "Wireframe", mais "CG", "FX", "UV" restent en capitales */
const displayCase = (s: string) =>
  s
    .split(' ')
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');

/** Une couche vidéo, lue en boucle sur la longueur commune (toutes les couches restent synchro). */
const LayerVideo: React.FC<{layer: Layer; loopFrames: number; objectPosition: string}> = ({
  layer,
  loopFrames,
  objectPosition,
}) => (
  <Loop durationInFrames={Math.max(1, loopFrames)}>
    <OffthreadVideo
      src={layer.src.startsWith('http') ? layer.src : staticFile(layer.src)}
      muted
      style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition}}
    />
  </Loop>
);

/** Rangée de labels : pills neutres Linear, l'active prend la surface + le point indigo. */
const LayerTabs: React.FC<{labels: string[]; activeness: number[]; maxWidth: number}> = ({
  labels,
  activeness,
  maxWidth,
}) => {
  const chars = labels.reduce((a, l) => a + l.length, 0);
  const fs = Math.max(17, Math.min(26, (maxWidth - labels.length * 70) / (chars * 0.62)));
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, maxWidth}}>
      {labels.map((label, i) => {
        const a = activeness[i] ?? 0;
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: fs * 0.5,
              padding: `${fs * 0.42}px ${fs * 0.78}px ${fs * 0.42}px ${fs * 0.6}px`,
              borderRadius: theme.radius.pill,
              border: `1.5px solid ${a > 0.5 ? 'rgba(255,255,255,0.14)' : theme.borderPill}`,
              background: `rgba(255,255,255,${0.02 + 0.05 * a})`,
              fontFamily: theme.mono,
              fontWeight: 500,
              fontSize: fs,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: a > 0.5 ? theme.fg : theme.meta,
            }}
          >
            <span
              style={{
                width: fs * 0.38,
                height: fs * 0.38,
                borderRadius: '50%',
                background: a > 0.02 ? theme.accentBright : theme.borderPill,
                opacity: 0.35 + 0.65 * a,
                boxShadow: a > 0.5 ? `0 0 ${fs * 0.6}px ${theme.accent}` : 'none',
              }}
            />
            {label}
          </div>
        );
      })}
    </div>
  );
};

/** Grand label de la couche en cours (display Inter 510, tracking négatif), qui change pendant le wipe. */
const LayerTitle: React.FC<{current: string; previous: string | null; p: number; size: number}> = ({
  current,
  previous,
  p,
  size,
}) => {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    bottom: 0,
    fontSize: size,
    lineHeight: 1,
    fontWeight: theme.weight.ui,
    letterSpacing: `${-0.022 * size}px`,
    color: theme.fg,
    whiteSpace: 'nowrap',
  };
  const half = TIMING.labelSwap / TIMING.wipe;
  const outP = previous ? interpolate(p, [0, half], [0, 1], clamp) : 1;
  const inP = previous ? interpolate(p, [half * 0.6, 1], [0, 1], clamp) : 1;
  return (
    <div style={{position: 'relative', height: size, width: '100%'}}>
      {previous && outP < 1 && (
        <span style={{...style, opacity: 1 - outP, transform: `translateY(${-0.25 * size * outP}px)`}}>
          {displayCase(previous)}
        </span>
      )}
      <span style={{...style, opacity: inP, transform: `translateY(${0.25 * size * (1 - inP)}px)`}}>
        {displayCase(current)}
      </span>
    </div>
  );
};

export const Breakdown: React.FC<ShotProps> = ({title, framing, cropX, layers, loopFrames}) => {
  const frame = useCurrentFrame();
  const {segments} = buildTimeline(layers.length);
  const idx = Math.max(0, segments.findIndex((s) => frame >= s.start && frame < s.end));
  const seg = segments[idx];
  const prev = idx > 0 ? segments[idx - 1] : null;

  // progression du wipe (0 → 1) au début de chaque segment, sauf le premier
  const p = prev ? interpolate(frame, [seg.start, seg.start + TIMING.wipe], [0, 1], {...clamp, easing: ease}) : 1;
  const wiping = prev !== null && p < 1;

  const activeness = layers.map((_, i) => {
    let a = i === seg.layer ? p : 0;
    if (wiping && prev && i === prev.layer) a += 1 - p;
    return Math.min(1, a);
  });
  const labels = layers.map((l) => l.label);
  const objectPosition = `${Math.round(cropX * 100)}% 50%`;
  const counter = `${pad(seg.layer + 1)} / ${pad(layers.length)}`;

  const crop = framing === 'crop';
  const ref = layers[layers.length - 1];
  const L = VIDEO.safeLeft;
  const R = VIDEO.safeRight;
  // largeur sûre pour du texte placé dans le bas de l'écran (sous la colonne d'icônes)
  const lowTextW = VIDEO.width - L - VIDEO.safeRightLow;
  const upTextW = VIDEO.width - L - R;
  const tabsH = 70;
  const longest = Math.max(...layers.map((l) => displayCase(l.label).length));
  // le grand titre rétrécit si un label est long, pour ne jamais passer sous les icônes
  const titleSize = Math.round(Math.min(crop ? 88 : 104, (crop ? lowTextW : upTextW) / (longest * 0.56)));

  // fit : bloc [overline, grand titre, carte du shot, labels] centré dans la zone sûre
  const safeH = VIDEO.height - VIDEO.safeTop - VIDEO.safeBottom;
  const chrome = 40 + 28 + titleSize + 44 + 44 + tabsH;
  let boxW = crop ? VIDEO.width : upTextW;
  let boxH = crop ? VIDEO.height : Math.round((boxW * ref.height) / ref.width);
  if (!crop && chrome + boxH > safeH) {
    // plan haut (4:5, 1:1…) : on réduit la carte pour que les labels restent au-dessus de la zone des icônes
    boxH = safeH - chrome;
    boxW = Math.round((boxH * ref.width) / ref.height);
  }
  const boxLeft = crop ? 0 : L + Math.round((upTextW - boxW) / 2);
  const blockH = chrome + boxH;
  const blockTop = VIDEO.safeTop + Math.max(0, (safeH - blockH) / 2);
  const titleTop = blockTop + 40 + 28;
  const boxTop = crop ? 0 : titleTop + titleSize + 44;
  const tabsTop = boxTop + boxH + 44;
  // les labels passent sous y = 1110 ? alors ils s'arrêtent avant la colonne d'icônes
  const tabsW = !crop && tabsTop + tabsH <= VIDEO.lowZoneStart ? upTextW : lowTextW;

  const media = (
    <>
      {wiping && prev && (
        <AbsoluteFill>
          <LayerVideo layer={layers[prev.layer]} loopFrames={loopFrames} objectPosition={objectPosition} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{clipPath: wiping ? `inset(0 ${(1 - p) * 100}% 0 0)` : undefined}}>
        <LayerVideo layer={layers[seg.layer]} loopFrames={loopFrames} objectPosition={objectPosition} />
      </AbsoluteFill>
      {wiping && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: p * boxW - 1,
            width: 2,
            background: theme.fg,
            boxShadow: '0 0 18px rgba(247,248,248,0.35)',
          }}
        />
      )}
    </>
  );

  const overline = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 24,
        fontFamily: theme.mono,
        fontSize: 22,
        fontWeight: 500,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: theme.muted,
      }}
    >
      <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{title || ''}</span>
      <span style={{color: theme.meta}}>{counter}</span>
    </div>
  );

  return (
    <AbsoluteFill
      style={{background: theme.bg, fontFamily: theme.font, fontFeatureSettings: theme.fontFeatures}}
    >
      {crop ? (
        <>
          <AbsoluteFill>{media}</AbsoluteFill>
          {/* voiles pour la lisibilité du texte, pas d'ombres portées */}
          <AbsoluteFill
            style={{
              background:
                'linear-gradient(to top, rgba(8,9,10,0.92) 0%, rgba(8,9,10,0.55) 22%, rgba(8,9,10,0) 42%), linear-gradient(to bottom, rgba(8,9,10,0.6) 0%, rgba(8,9,10,0) 20%)',
            }}
          />
          <div style={{position: 'absolute', left: L, right: R, top: VIDEO.safeTop}}>{overline}</div>
          <div
            style={{
              position: 'absolute',
              left: L,
              width: lowTextW,
              bottom: VIDEO.safeBottom + tabsH + 40,
            }}
          >
            <LayerTitle
              current={layers[seg.layer].label}
              previous={wiping && prev ? layers[prev.layer].label : null}
              p={p}
              size={titleSize}
            />
          </div>
          <div style={{position: 'absolute', left: L, width: lowTextW, bottom: VIDEO.safeBottom, display: 'flex'}}>
            <LayerTabs labels={labels} activeness={activeness} maxWidth={lowTextW} />
          </div>
        </>
      ) : (
        <>
          <div style={{position: 'absolute', left: L, right: R, top: blockTop}}>{overline}</div>
          <div style={{position: 'absolute', left: L, width: tabsTop > VIDEO.lowZoneStart ? lowTextW : upTextW, top: titleTop}}>
            <LayerTitle
              current={layers[seg.layer].label}
              previous={wiping && prev ? layers[prev.layer].label : null}
              p={p}
              size={titleSize}
            />
          </div>
          {/* carte du shot : surface panel, bordure fine + inset, rayon "large panel" */}
          <div
            style={{
              position: 'absolute',
              left: boxLeft,
              top: boxTop,
              width: boxW,
              height: boxH,
              borderRadius: theme.radius.large,
              overflow: 'hidden',
              background: theme.panel,
              boxShadow: `0 0 0 1.5px ${theme.border}`,
            }}
          >
            {media}
            <AbsoluteFill
              style={{
                borderRadius: theme.radius.large,
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 24px rgba(0,0,0,0.25)',
              }}
            />
          </div>
          <div style={{position: 'absolute', left: L, width: tabsW, top: tabsTop, display: 'flex'}}>
            <LayerTabs labels={labels} activeness={activeness} maxWidth={tabsW} />
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
