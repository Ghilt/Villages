import type { CSSProperties } from 'react';

import { Channels } from '../../ui/diorama/Channels';
import { Diorama, OnFoot } from '../../ui/diorama/Diorama';
import type { Placed, Standing } from '../../ui/diorama/Diorama';
import { latticeAt, latticeOf } from '../../ui/diorama/lattice';
import { LatticeGround } from '../../ui/diorama/LatticeGround';
import { Mist } from '../../ui/diorama/Mist';
import { FieldFigure } from '../../ui/fieldFigure/FieldFigure';
import { ReplayBar } from '../../ui/replay/Replay';
import type { Band } from '../../ui/replay/Replay';
import { useExactSecond, useReplayClock } from '../../ui/replay/useReplayClock';
import type { ReplayClock } from '../../ui/replay/useReplayClock';
import { HappeningSeal } from '../../ui/seal/HappeningSeal';
import { sealsAt, spotAlong } from '../../ui/seal/sealPath';
import type { AspectShown } from '../../ui/slice/Slice';
import { useAtlas } from '../frame/Atlas';
import type { Atlas } from '../frame/Atlas';
import { BRANNOCK, DIPLOMACY, HOLY, REASON, VARGA, VIOLENCE } from './challengeSamples';
import { Part, Specimen, Specimens } from './Specimen';

const SCENE = { width: 900, height: 520 };
const CELL = 20;
const LATTICE = latticeOf({ x: 440, y: 190 }, CELL);
const corner = (u: number, v: number) => latticeAt(LATTICE, u, v);
const MIST = corner(1, 1);
const RECEPTACLE = corner(6, 12);
const PATH = [MIST, corner(1, 7), corner(6, 7), RECEPTACLE];
const LAST = 30;
const TIMING = { form: 1.5, lead: 4 };
const HAPPENINGS: readonly (readonly AspectShown[])[] = [[HOLY], [REASON], [DIPLOMACY, VIOLENCE], [HOLY]];
const ARRIVALS = [2, 9, 16, 23];

const BOX: CSSProperties = { border: '1px solid #3d3427', borderRadius: 4, overflow: 'hidden' };

/** A stand-in receptacle, a stone font, until a venue draws its own. */
function Font() {
  return (
    <svg width="90" height="56" viewBox="0 0 90 56" aria-hidden="true" style={{ display: 'block' }}>
      <ellipse cx="45" cy="46" rx="40" ry="10" fill="#8f8574" stroke="#2b1d10" strokeWidth="1.5" />
      <path d="M8 30 L8 46 Q45 60 82 46 L82 30 Z" fill="#a39885" stroke="#2b1d10" strokeWidth="1.5" />
      <ellipse cx="45" cy="30" rx="37" ry="10" fill="#c4b9a3" stroke="#2b1d10" strokeWidth="1.5" />
      <ellipse cx="45" cy="30" rx="27" ry="6.5" fill="#6f7f86" stroke="#2b1d10" strokeWidth="1" />
    </svg>
  );
}

/** The seals over the scene, each where the second to the moment puts it: drawn again every frame while it plays. */
function Seals({ clock }: { clock: ReplayClock }) {
  const now = useExactSecond(clock);
  return (
    <>
      {sealsAt(now, ARRIVALS, TIMING).map((seal) => {
        const spot = spotAlong(PATH, seal.along);
        return (
          <OnFoot key={seal.index} x={spot.x} y={spot.y}>
            <HappeningSeal aspects={HAPPENINGS[seal.index] ?? [HOLY]} state={seal.state} cell={CELL} />
          </OnFoot>
        );
      })}
    </>
  );
}

/** Happenings coming out of the mist along their path to a font, played, scrubbed and played again. */
function Travelling() {
  const clock = useReplayClock(LAST, { autoplay: 600 });
  const structures = useAtlas<Atlas>('structures');
  const palace =
    structures !== null && structures !== 'missing' ? structures.frames['palace@european'] : undefined;
  const pictures: Standing[] =
    palace === undefined || structures === null || structures === 'missing'
      ? []
      : [
          {
            id: 'palace',
            sheet: {
              src: `/art/structures.webp?v=${structures.version}`,
              width: structures.width,
              height: structures.height,
            },
            frame: palace,
            foot: { x: palace.footX ?? 0.5, y: 1 },
            x: 440,
            y: 190,
            height: 10 * CELL,
          },
        ];
  const placed: Placed[] = [
    { id: 'mist', x: MIST.x, y: MIST.y + 14, depth: MIST.y, node: <Mist width={150} /> },
    { id: 'font', x: RECEPTACLE.x, y: RECEPTACLE.y + 18, depth: RECEPTACLE.y - 1, node: <Font /> },
    {
      id: 'a',
      ...latticeAt(LATTICE, -9.5, 13.5),
      node: <FieldFigure kind="keyFigure" facing="east" colour={VARGA} name="Lady Ilse" height={3 * CELL} />,
    },
    {
      id: 'b',
      ...latticeAt(LATTICE, 15.5, 1.5),
      node: (
        <FieldFigure kind="keyFigure" facing="west" colour={BRANNOCK} name="Master Oswin" height={3 * CELL} />
      ),
    },
  ];
  const bands: Band[] = ARRIVALS.map((at, index) => ({
    from: at,
    to: ARRIVALS[index + 1] ?? LAST,
    name: (HAPPENINGS[index] ?? []).map((aspect) => aspect.name).join(' and '),
    colours: (HAPPENINGS[index] ?? []).map((aspect) => aspect.colour),
    marks: (HAPPENINGS[index] ?? []).map((aspect) => aspect.mark),
  }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 'min(620px, 100%)' }}>
      <div style={{ ...BOX, height: 360 }}>
        <Diorama
          scene={SCENE}
          ground={
            <>
              <LatticeGround
                scene={SCENE}
                lattice={LATTICE}
                id="showcase-travel"
                fill="#cbbd9c"
                joint="rgba(60,48,30,0.3)"
              />
              <Channels scene={SCENE} paths={[PATH]} />
            </>
          }
          pictures={pictures}
          placed={placed}
          over={<Seals clock={clock} />}
          label="Happenings travelling to a font"
        />
      </div>
      <ReplayBar
        second={clock.second}
        last={LAST}
        playing={clock.playing}
        pace={clock.pace}
        onPlay={clock.play}
        onPause={clock.pause}
        onQuicken={clock.quicken}
        onShow={clock.show}
        onToEnd={clock.toEnd}
        seen={clock.seen}
        bands={bands}
        tug={Array.from({ length: LAST + 1 }, () => 0)}
      />
    </div>
  );
}

/** How a happening travels through a venue: out of the mist, along the channels, to the receptacle. */
export function ChallengeTravel() {
  return (
    <Part title="A happening travelling">
      <p className="ui-label showcase__lead">
        Each happening’s seal waits faded in a patch of mist, <code>Mist</code>, from the moment the one
        before it sets out, forms there a second and a half before it sets out itself, slides along the
        venue’s path for four seconds, laid in the ground as a gilt channel along the cells’ sides,{' '}
        <code>Channels</code>, and reaches the receptacle on its second, staying until the next arrives. Where
        each stands is worked out from the second alone, <code>sealsAt</code> and <code>spotAlong</code>, so
        scrubbing back puts it where it was; while it plays the second is read to the moment,{' '}
        <code>useExactSecond</code>, and the seals slide, drawn over the diorama, <code>Diorama over</code>,
        so nothing else is drawn again. The font is a stand-in a venue draws its own of. As a seal arrives it
        strikes the slices it lights: see Lightning, below.
      </p>
      <Specimens>
        <Specimen name="Mist, Channels, HappeningSeal on its path" note="plays by itself; scrub it" wide>
          <Travelling />
        </Specimen>
      </Specimens>
    </Part>
  );
}
