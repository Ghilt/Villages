import type { CSSProperties } from 'react';

import { Diorama } from '../../ui/diorama/Diorama';
import type { Placed, Standing } from '../../ui/diorama/Diorama';
import { latticeAt, latticeOf } from '../../ui/diorama/lattice';
import { LatticeGround } from '../../ui/diorama/LatticeGround';
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

const BOX: CSSProperties = { border: '1px solid #3d3427', borderRadius: 4, overflow: 'hidden' };

/** How many of the scene's units a world unit is: a cell of the cobbles. */
const CELL = 20;

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
  const lattice = latticeOf(wide ? { x: 440, y: 205 } : { x: 236, y: 230 }, CELL);
  const corner = (u: number, v: number) => latticeAt(lattice, u, v);
  const cell = (u: number, v: number) => latticeAt(lattice, u + 0.5, v + 0.5);
  const at = (point: { x: number; y: number }, name: 'structures' | 'scenery', key: string, tall: number) =>
    picture(name, name === 'structures' ? structures : scenery, key, point.x, point.y, tall * CELL);
  const pictures = [
    at(cell(wide ? -15 : -9, wide ? 7 : 4), 'scenery', 'oak', 4.8),
    at(cell(wide ? 15 : 9, wide ? -10 : -6), 'scenery', 'pine', 3),
    at(corner(0, 0), 'structures', 'palace@european', 10),
    at(corner(wide ? -8 : -5, wide ? 4 : 6), 'structures', 'market@european', 5.6),
    at(corner(wide ? 10 : 7, wide ? -4 : 0), 'structures', 'manor@european', 6),
  ].filter((one): one is Standing => one !== null);
  const placed: Placed[] = [
    {
      id: 'varga',
      ...cell(wide ? -6 : -3, wide ? 13 : 15),
      node: (
        <FieldFigure
          kind="summon"
          facing="east"
          colour={VARGA}
          aspect={HOLY}
          lit
          name="Priest #4"
          height={3 * CELL}
        />
      ),
    },
    {
      id: 'brannock',
      ...cell(wide ? 13 : 12, wide ? 3 : 7),
      node: (
        <FieldFigure
          kind="summon"
          facing="west"
          colour={BRANNOCK}
          aspect={INDUSTRY}
          name="Machine #2"
          height={3 * CELL}
        />
      ),
    },
    ...[
      [2, 9],
      [4, 9],
      [3, 10],
      [6, 7],
      [7, 8],
    ].map(([u = 0, v = 0], at) => ({
      id: `townsperson-${at}`,
      ...cell(u, wide ? v : v + 3),
      node: (
        <FieldFigure kind="townsperson" facing={at < 3 ? 'west' : 'east'} height={Math.round(2.4 * CELL)} />
      ),
    })),
  ];
  return (
    <div style={{ ...BOX, width: wide ? 560 : 300, height: wide ? 320 : 470, maxWidth: '100%' }}>
      <Diorama
        scene={scene}
        ground={
          <LatticeGround
            scene={scene}
            lattice={lattice}
            id={`showcase-cobbles-${wide ? 'wide' : 'deep'}`}
            fill="#cbbd9c"
            joint="rgba(60,48,30,0.3)"
          />
        }
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
        of its own units scaled to cover its box. Its ground is the map’s own lattice,{' '}
        <code>LatticeGround</code>, turned and tipped as the map’s is, a world unit to a cell: each building
        stands on the front corner of its footprint as tall as the map draws it, each figure in the middle of
        a cell. It reads the map’s sheets, <code>public/art/structures.webp</code> and{' '}
        <code>scenery.webp</code>, as the map cuts them; nothing new to paint.
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
