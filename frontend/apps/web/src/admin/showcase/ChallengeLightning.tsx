import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { MarkButton } from '../../ui/button/Button';
import { latticeOf } from '../../ui/diorama/lattice';
import { LatticeGround } from '../../ui/diorama/LatticeGround';
import { Lightning } from '../../ui/lightning/Lightning';
import type { Glow, Look, Strike } from '../../ui/lightning/Lightning';
import { LOOKS, REACHES } from '../../ui/lightning/strike';
import { SliceChip } from '../../ui/slice/Slice';
import { HOLY, REASON } from './challengeSamples';
import { Part, Specimen, Specimens } from './Specimen';

const SIZE = { width: 640, height: 300 };
const SOURCE = { x: 150, y: 150 };
const GROUND = latticeOf({ x: 120, y: 40 }, 24);
const GOLD = 'var(--ui-gilt-light)';
const BOX: CSSProperties = {
  position: 'relative',
  width: SIZE.width,
  maxWidth: '100%',
  height: SIZE.height,
  border: '1px solid #3d3427',
  borderRadius: 4,
  overflow: 'hidden',
};

/** When each look is at its brightest, to be held at: the bolt whole, the strike come back, the threads writhing. */
const HELD: Readonly<Record<Look, number>> = { forked: 260, leader: 340, tendrils: 420 };

const GLOWS: readonly Glow[] = ['strokes', 'shader'];

/** A stand-in receptacle the strikes come from: a basin of water glowing a little. */
function Source() {
  return (
    <svg
      width="70"
      height="40"
      viewBox="0 0 70 40"
      aria-hidden="true"
      style={{ position: 'absolute', left: SOURCE.x - 35, top: SOURCE.y - 14 }}
    >
      <path d="M2 12 L2 26 A33 12 0 0 0 68 26 L68 12 Z" fill="#a39885" stroke="#2b1d10" strokeWidth="1.5" />
      <ellipse cx="35" cy="12" rx="33" ry="11" fill="#c4b9a3" stroke="#2b1d10" strokeWidth="1.5" />
      <ellipse cx="35" cy="12" rx="24" ry="7.5" fill="#6f7f86" stroke="#2b1d10" strokeWidth="1" />
    </svg>
  );
}

/**
 * A strike from a basin to two slices on the square's cobbles: held at a moment, or struck again each time it is
 * pressed. The slices are measured where they stand, as the spectacle measures its own.
 */
function Struck({ look, glow, at, again = 0 }: { look: Look; glow: Glow; at?: number; again?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const holy = useRef<HTMLButtonElement>(null);
  const reason = useRef<HTMLButtonElement>(null);
  const [strikes, setStrikes] = useState<readonly Strike[]>([]);
  useLayoutEffect(() => {
    const frame = box.current?.getBoundingClientRect();
    if (frame === undefined) return;
    const strikeOf = (chip: HTMLButtonElement | null, name: string, colour: string): Strike[] => {
      const rect = chip?.getBoundingClientRect();
      return rect === undefined
        ? []
        : [
            {
              key: `${again}-${name}`,
              from: SOURCE,
              to: {
                x: rect.left - frame.left,
                y: rect.top - frame.top,
                width: rect.width,
                height: rect.height,
              },
              colour,
            },
          ];
    };
    setStrikes([
      ...strikeOf(holy.current, 'holy', GOLD),
      ...strikeOf(reason.current, 'reason', REASON.colour),
    ]);
  }, [again]);
  const jolt = (colour: string) =>
    at === undefined ? { jolt: { key: again, colour, delay: REACHES[look] } } : {};
  return (
    <div ref={box} style={BOX}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <LatticeGround
          scene={SIZE}
          lattice={GROUND}
          id={`strike-${look}-${glow}-${at ?? 'live'}`}
          fill="#3b3326"
          joint="rgba(0,0,0,0.35)"
        />
      </div>
      <Source />
      <div
        style={{
          position: 'absolute',
          right: 14,
          bottom: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <SliceChip ref={holy} aspect={HOLY} state="matching" {...jolt(GOLD)} />
        <SliceChip ref={reason} aspect={REASON} state="answering" {...jolt(REASON.colour)} />
      </div>
      <Lightning strikes={strikes} look={look} glow={glow} at={at} />
    </div>
  );
}

/** How long the pane in `Opening` waits before it opens, so the bolt comes down on it as it starts to. */
const OPENS_AFTER = 250;

/**
 * A strike on a pane opening out from a chip, as the choice roll's die strikes the hand it drew: the strike follows
 * the pane's box every frame, so the bolt lands on it and the crackle runs round its edges as they grow.
 */
function Opening() {
  const box = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const [again, setAgain] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
    const opening = window.setTimeout(() => setOpen(true), OPENS_AFTER);
    return () => window.clearTimeout(opening);
  }, [again]);
  // One strike a press, which reads where the pane is each frame.
  const strikes = useMemo((): readonly Strike[] => {
    const follow = () => {
      const frame = box.current?.getBoundingClientRect();
      const rect = pane.current?.getBoundingClientRect();
      if (frame === undefined || rect === undefined) return null;
      return { x: rect.left - frame.left, y: rect.top - frame.top, width: rect.width, height: rect.height };
    };
    return [
      {
        key: `opening-${again}`,
        from: SOURCE,
        to: { x: 520, y: 250, width: 100, height: 30 },
        colour: GOLD,
        follow,
      },
    ];
  }, [again]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div ref={box} style={BOX}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <LatticeGround
            scene={SIZE}
            lattice={GROUND}
            id="strike-opening"
            fill="#3b3326"
            joint="rgba(0,0,0,0.35)"
          />
        </div>
        <Source />
        <div
          ref={pane}
          style={{
            position: 'absolute',
            right: 20,
            bottom: 20,
            width: open ? 300 : 100,
            height: open ? 230 : 30,
            background: '#2a2219',
            border: '2px solid #8a7246',
            borderRadius: 4,
            transition: 'width 160ms ease-out, height 160ms ease-out',
          }}
        />
        <Lightning strikes={strikes} look="leader" glow="shader" />
      </div>
      <div>
        <MarkButton label="Strike again" mark="play" onClick={() => setAgain(again + 1)} />
      </div>
    </div>
  );
}

/** A strike to watch again and again, in any look and either way of drawing it. */
function Live() {
  const [look, setLook] = useState<Look>('leader');
  const [glow, setGlow] = useState<Glow>('shader');
  const [again, setAgain] = useState(0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Struck look={look} glow={glow} again={again} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <MarkButton label="Strike again" mark="play" onClick={() => setAgain(again + 1)} />
        {LOOKS.map((one) => (
          <button
            key={one}
            type="button"
            className="inspect-button"
            aria-pressed={look === one}
            onClick={() => setLook(one)}
          >
            {one}
          </button>
        ))}
        {GLOWS.map((one) => (
          <button
            key={one}
            type="button"
            className="inspect-button"
            aria-pressed={glow === one}
            onClick={() => setGlow(one)}
          >
            {one}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Lightning from a receptacle to the slices a happening lights, in each look, drawn both ways. */
export function ChallengeLightning() {
  return (
    <Part title="Lightning">
      <p className="ui-label showcase__lead">
        As a happening’s seal comes to rest in the receptacle it strikes every slice it lights:{' '}
        <code>Lightning</code>, laid over the whole spectacle, an arc rising through the air from the
        receptacle and coming down on the slice, which crackles round its edge and flashes. The bolt is
        midpoint displacement along the arc, so it is guided to whatever it strikes; worked out again with
        another seed it flickers, with the same one it grows. <code>forked</code> leaps the whole way and
        forks; <code>leader</code> feels its way in jerks, then strikes back along the same channel, twice;{' '}
        <code>tendrils</code> writhes, as from a coil. Each is drawn as <code>strokes</code> on a canvas or by
        a <code>shader</code> lighting every pixel by how near it is to the bolt. Gold where a slice matches,
        the aspect’s colour where it answers.
      </p>
      <Specimens>
        {LOOKS.flatMap((look) =>
          GLOWS.map((glow) => (
            <Specimen
              key={`${look}-${glow}`}
              name={`Lightning look="${look}" glow="${glow}"`}
              note={`held at ${HELD[look]} ms`}
              wide
            >
              <Struck look={look} glow={glow} at={HELD[look]} />
            </Specimen>
          )),
        )}
        <Specimen name='Lightning look="leader"' note="its leader feeling the way, held at 190 ms" wide>
          <Struck look="leader" glow="shader" at={190} />
        </Specimen>
        <Specimen name="Lightning, struck" note="press to strike again; choose its look and its drawing" wide>
          <Live />
        </Specimen>
        <Specimen
          name="Lightning, a strike that follows its box"
          note="the pane opens out as the bolt reaches it, and the crackle runs round its edges as they grow; press to strike again"
          wide
        >
          <Opening />
        </Specimen>
      </Specimens>
    </Part>
  );
}
