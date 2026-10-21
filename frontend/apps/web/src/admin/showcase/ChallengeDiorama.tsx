import type { CSSProperties } from 'react';

import { Diorama } from '../../ui/diorama/Diorama';
import type { Placed, Standing } from '../../ui/diorama/Diorama';
import { FieldFigure } from '../../ui/fieldFigure/FieldFigure';
import { useAtlas } from '../frame/Atlas';
import type { Atlas } from '../frame/Atlas';
import { BRANNOCK, HOLY, INDUSTRY, VARGA } from './challengeSamples';
import { Part, Specimen, Specimens } from './Specimen';

/** The scenery's frames say their foot in their own pixels; the structures' say it across, as a share. */
interface SceneryAtlas extends Atlas {
  readonly frames: Readonly<Record<string, Atlas['frames'][string] & { readonly footY?: number }>>;
}

/** A picture of the map's, standing at (x, y) in a scene, `height` tall. */
function picture(
  name: 'structures' | 'scenery',
  atlas: SceneryAtlas,
  key: string,
  x: number,
  y: number,
  height: number,
) {
  const frame = atlas.frames[key];
  if (frame === undefined) {
    return null;
  }
  const foot =
    name === 'structures'
      ? { x: frame.footX ?? 0.5, y: 1 }
      : {
          x: (frame.footX ?? frame.width / 2) / frame.width,
          y: (frame.footY ?? frame.height) / frame.height,
        };
  const standing: Standing = {
    id: `${key}-${x}-${y}`,
    sheet: { src: `/art/${name}.webp?v=${atlas.version}`, width: atlas.width, height: atlas.height },
    frame,
    foot,
    x,
    y,
    height,
  };
  return standing;
}

/** A square's cobbles, the diamonds turned as the map's ground is. */
function Cobbles({ width, height }: { width: number; height: number }) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <pattern id="showcase-cobbles" width="40" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 10 L20 0 L40 10 L20 20 Z" fill="none" stroke="rgba(60,48,30,0.16)" />
        </pattern>
        <linearGradient id="showcase-cobbles-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c4b593" />
          <stop offset="1" stopColor="#d3c6a6" />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill="url(#showcase-cobbles-light)" />
      <rect width={width} height={height} fill="url(#showcase-cobbles)" />
    </svg>
  );
}

const BOX: CSSProperties = { border: '1px solid #3d3427', borderRadius: 4, overflow: 'hidden' };

/** A corner of a square: a palace and a market among trees, a figure of each house facing the other, and townsfolk. */
function Sample({ wide }: { wide: boolean }) {
  const structures = useAtlas<SceneryAtlas>('structures');
  const scenery = useAtlas<SceneryAtlas>('scenery');
  if (structures === null || scenery === null) {
    return <p className="showcase__to-come">Reading the map’s sheets…</p>;
  }
  if (structures === 'missing' || scenery === 'missing') {
    return <p className="showcase__to-come">The map’s sheets are not cut in this tree: npm run world:art.</p>;
  }
  const scene = wide ? { width: 900, height: 500 } : { width: 500, height: 800 };
  const across = (share: number) => share * scene.width;
  const down = (share: number) => share * scene.height;
  const pictures = [
    picture('scenery', scenery, 'oak', across(0.08), down(wide ? 0.34 : 0.22), 130),
    picture('scenery', scenery, 'pine', across(0.94), down(wide ? 0.3 : 0.2), 120),
    picture('structures', structures, 'palace@european', across(0.5), down(wide ? 0.42 : 0.3), 190),
    picture('structures', structures, 'market@european', across(0.22), down(wide ? 0.46 : 0.36), 140),
    picture('structures', structures, 'manor@european', across(0.8), down(wide ? 0.45 : 0.36), 140),
  ].filter((one): one is Standing => one !== null);
  const placed: Placed[] = [
    {
      id: 'varga',
      x: across(0.18),
      y: down(wide ? 0.75 : 0.62),
      node: <FieldFigure kind="summon" facing="east" colour={VARGA} aspect={HOLY} lit name="Priest #4" />,
    },
    {
      id: 'brannock',
      x: across(0.82),
      y: down(wide ? 0.75 : 0.62),
      node: <FieldFigure kind="summon" facing="west" colour={BRANNOCK} aspect={INDUSTRY} name="Machine #2" />,
    },
    ...[0.38, 0.44, 0.41, 0.58, 0.62].map((share, at) => ({
      id: `townsperson-${at}`,
      x: across(share),
      y: down((wide ? 0.66 : 0.55) + (at % 3) * 0.06),
      node: <FieldFigure kind="townsperson" facing={share < 0.5 ? 'west' : 'east'} height={52} />,
    })),
  ];
  return (
    <div style={{ ...BOX, width: wide ? 560 : 300, height: wide ? 320 : 470, maxWidth: '100%' }}>
      <Diorama
        scene={scene}
        ground={<Cobbles width={scene.width} height={scene.height} />}
        pictures={pictures}
        placed={placed}
        label="A corner of a square"
      />
    </div>
  );
}

/** The diorama a challenge is watched in, held both ways. */
export function ChallengeDiorama() {
  return (
    <Part title="The diorama">
      <p className="ui-label showcase__lead">
        A small piece of the world drawn as the map draws it, from the south and above: the map’s own
        pictures, each on its foot and in front of what stands behind it, and figures among them, in a scene
        of its own units scaled to cover its box. It reads the map’s sheets,{' '}
        <code>public/art/structures.webp</code> and <code>scenery.webp</code>, as the map cuts them; nothing
        new to paint.
      </p>
      <Specimens>
        <Specimen name="Diorama, held wide" note="a scene 900 by 500 covering a box 560 by 320" wide>
          <Sample wide />
        </Specimen>
        <Specimen name="Diorama, held deep" note="a scene 500 by 800 in a box 300 by 470">
          <Sample wide={false} />
        </Specimen>
      </Specimens>
    </Part>
  );
}
