import React from 'react';
import {Composition, staticFile} from 'remotion';
import {loadFont} from '@remotion/fonts';
import {Breakdown} from './Breakdown';
import {buildTimeline} from './timeline';
import {VIDEO} from './theme';
import type {ShotProps} from './types';

loadFont({family: 'Inter', url: staticFile('fonts/inter-variable.woff2'), weight: '100 900'});
loadFont({family: 'JetBrains Mono', url: staticFile('fonts/jetbrains-mono-latin-500-normal.woff2'), weight: '500'});

// Props d'exemple (écrasées au rendu par --props=shots/<shot>.json)
const demo: ShotProps = {
  shotName: 'demo',
  framing: 'fit',
  cropX: 0.5,
  loopFrames: 150,
  layers: [
    {src: 'shots/demo/01_plate.mp4', label: 'PLATE', durationInFrames: 150, width: 1280, height: 720},
    {src: 'shots/demo/99_final.mp4', label: 'FINAL', durationInFrames: 150, width: 1280, height: 720},
  ],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Breakdown"
    component={Breakdown as unknown as React.FC<Record<string, unknown>>}
    width={VIDEO.width}
    height={VIDEO.height}
    fps={VIDEO.fps}
    durationInFrames={300}
    defaultProps={demo as unknown as Record<string, unknown>}
    calculateMetadata={({props}) => ({
      durationInFrames: buildTimeline((props as unknown as ShotProps).layers.length).total,
    })}
  />
);
