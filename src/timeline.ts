import {TIMING} from './theme';

export type Segment = {
  /** index dans props.layers */
  layer: number;
  start: number;
  end: number;
};

/**
 * Construit la suite : FINAL → PLATE → passes… → FINAL.
 * Les couches intermédiaires se partagent la durée visée (10-15 s au total).
 */
export function buildTimeline(layerCount: number): {segments: Segment[]; total: number; hold: number} {
  const finalIdx = layerCount - 1;
  const middle = Array.from({length: finalIdx}, (_, i) => i); // plate + passes
  const available = TIMING.targetTotal - TIMING.firstHold - TIMING.lastHold;
  const hold = Math.round(
    Math.min(TIMING.maxHold, Math.max(TIMING.minHold, available / Math.max(1, middle.length))),
  );

  const order = [finalIdx, ...middle, finalIdx];
  const segments: Segment[] = [];
  let t = 0;
  order.forEach((layer, i) => {
    const d = i === 0 ? TIMING.firstHold : i === order.length - 1 ? TIMING.lastHold : hold;
    segments.push({layer, start: t, end: t + d});
    t += d;
  });
  return {segments, total: t, hold};
}
