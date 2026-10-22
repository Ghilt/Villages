import { useEffect } from 'react';
import type { CSSProperties } from 'react';

import { Channels } from '../../ui/diorama/Channels';
import { Diorama } from '../../ui/diorama/Diorama';
import type { Placed, Standing } from '../../ui/diorama/Diorama';
import { Mist } from '../../ui/diorama/Mist';
import { FieldFigure } from '../../ui/fieldFigure/FieldFigure';
import { ReplayBar } from '../../ui/replay/Replay';
import type { Band } from '../../ui/replay/Replay';
import { useReplayClock } from '../../ui/replay/useReplayClock';
import { HappeningSeal } from '../../ui/seal/HappeningSeal';
import { sealsAt, spotAlong } from '../../ui/seal/sealPath';
import type { AspectShown } from '../../ui/slice/Slice';
import { useAtlas } from '../frame/Atlas';
import type { Atlas } from '../frame/Atlas';
import { BRANNOCK, DIPLOMACY, HOLY, REASON, VARGA, VIOLENCE } from './challengeSamples';
import { Part, Specimen, Specimens } from './Specimen';

const SCENE = { width: 900, height: 520 };
const MIST = { x: 450, y: 205 };
const RECEPTACLE = { x: 450, y: 440 };
const PATH = [MIST, { x: 430, y: 270 }, { x: 470, y: 340 }, { x: 445, y: 400 }, RECEPTACLE];
const TO_A = [RECEPTACLE, { x: 330, y: 455 }, { x: 170, y: 380 }];
const TO_B = [RECEPTACLE, { x: 570, y: 455 }, { x: 730, y: 380 }];
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

/** Happenings coming out of the mist along their path to a font, played, scrubbed and played again. */
function Travelling() {
  const clock = useReplayClock(LAST, 0);
  const structures = useAtlas<Atlas>('structures');
  const { play } = clock;
  useEffect(() => play(), [play]);
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
            x: 450,
            y: 190,
            height: 170,
          },
        ];
  const seals: Placed[] = sealsAt(clock.second, ARRIVALS, TIMING).map((seal) => {
    const spot = spotAlong(PATH, seal.along);
    return {
      id: `seal-${seal.index}`,
      x: spot.x,
      y: spot.y,
      depth: 2000,
      walk: 0.7,
      node: <HappeningSeal aspects={HAPPENINGS[seal.index] ?? [HOLY]} state={seal.state} size={56} />,
    };
  });
  const placed: Placed[] = [
    { id: 'mist', x: MIST.x, y: MIST.y + 14, depth: MIST.y, node: <Mist width={150} /> },
    { id: 'font', x: RECEPTACLE.x, y: RECEPTACLE.y + 18, depth: RECEPTACLE.y - 1, node: <Font /> },
    {
      id: 'a',
      x: 170,
      y: 380,
      node: <FieldFigure kind="keyFigure" facing="east" colour={VARGA} name="Lady Ilse" />,
    },
    {
      id: 'b',
      x: 730,
      y: 380,
      node: <FieldFigure kind="keyFigure" facing="west" colour={BRANNOCK} name="Master Oswin" />,
    },
    ...seals,
  ];
  const bands: Band[] = ARRIVALS.map((at, index) => ({
    from: at,
    to: ARRIVALS[index + 1] ?? LAST,
    name: (HAPPENINGS[index] ?? []).map((aspect) => aspect.name).join(' and '),
    colours: (HAPPENINGS[index] ?? []).map((aspect) => aspect.colour),
  }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 'min(620px, 100%)' }}>
      <div style={{ ...BOX, height: 360 }}>
        <Diorama
          scene={SCENE}
          ground={
            <>
              <svg
                viewBox={`0 0 ${SCENE.width} ${SCENE.height}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <rect width={SCENE.width} height={SCENE.height} fill="#cbbd9c" />
              </svg>
              <Channels scene={SCENE} paths={[PATH, TO_A, TO_B]} />
            </>
          }
          pictures={pictures}
          placed={placed}
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
        Each happening’s seal forms in a patch of mist, <code>Mist</code>, a second and a half before it sets
        out, comes along the venue’s path for four seconds, laid in the ground as gilt channels,{' '}
        <code>Channels</code>, and reaches the receptacle on its second, staying until the next arrives. Where
        each stands is worked out from the second alone, <code>sealsAt</code> and <code>spotAlong</code>, so
        scrubbing back puts it where it was. The font is a stand-in a venue draws its own of.
      </p>
      <Specimens>
        <Specimen name="Mist, Channels, HappeningSeal on its path" note="plays by itself; scrub it" wide>
          <Travelling />
        </Specimen>
      </Specimens>
    </Part>
  );
}
