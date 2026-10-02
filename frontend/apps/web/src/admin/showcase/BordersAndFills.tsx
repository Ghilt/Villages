import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type { Repeat, Sides } from '@villages/world';

import { pictureIn, usePictures } from '../../ui/art/pictures';
import { BorderLayer, FillLayer } from '../../ui/border/Border';
import { contentInsetOf, fillInsetOf } from '../../ui/border/borderStyle';
import { Part, Specimen, Specimens } from './Specimen';

const REPEATS: readonly Repeat[] = ['stretch', 'round', 'repeat', 'space'];

/** The sizes a box can be put at with one press, from a pip to a pane. */
const SIZES = [
  { width: 60, height: 60 },
  { width: 120, height: 90 },
  { width: 240, height: 150 },
  { width: 360, height: 220 },
  { width: 640, height: 320 },
];

/** The screens a player has, as Windows scales them: the density a nine-slice's seams depend on. */
const SCALINGS = [1, 1.25, 1.5, 2];

/**
 * A box with a border round it and perhaps a fill in it, a fixed size, with where its content would start
 * outlined - the showcase's own, for looking at a border. The library's container is in the next section.
 */
function Box({
  border,
  fill,
  width,
  height,
  repeat,
  cuts = false,
  children,
}: {
  border: string;
  fill?: string;
  width: number | string;
  height: number | string;
  repeat?: readonly [Repeat, Repeat];
  cuts?: boolean;
  children?: ReactNode;
}) {
  const { list } = usePictures();
  const slice = pictureIn(list, 'borders', border)?.border;
  const [top, right, bottom, left] = contentInsetOf(slice);
  return (
    <div className="showcase__box" style={{ width, height }}>
      {fill !== undefined && <FillLayer name={fill} inset={fillInsetOf(slice)} />}
      <BorderLayer
        name={border}
        {...(fill === undefined ? {} : { middle: false })}
        {...(repeat ? { repeat } : {})}
      />
      {cuts && slice !== undefined && <Cuts slice={slice.slice} />}
      <div className="showcase__box-content" style={{ top, right, bottom, left }}>
        {children}
      </div>
    </div>
  );
}

/** The four cuts, drawn over a border as lines, so a wrong number is seen rather than guessed. */
function Cuts({ slice }: { slice: Sides }) {
  const [top, right, bottom, left] = slice;
  return (
    <div className="showcase__cuts" aria-hidden>
      <span className="showcase__cut showcase__cut--across" style={{ top }} />
      <span className="showcase__cut showcase__cut--across" style={{ bottom }} />
      <span className="showcase__cut showcase__cut--down" style={{ left }} />
      <span className="showcase__cut showcase__cut--down" style={{ right }} />
    </div>
  );
}

export function BordersAndFills() {
  const { list, problem } = usePictures();
  if (list === null) {
    return <p className="showcase__to-come">{problem ?? 'Reading the pictures…'}</p>;
  }
  const borders = list.pictures.filter((picture) => picture.kind === 'borders');
  const fills = list.pictures.filter((picture) => picture.kind === 'fills');
  return (
    <>
      <Part title="Any size">
        <p className="ui-label showcase__lead">
          One border, one box, dragged by its corner or put at a size with a press. The dashed lines are its
          cuts: the corners outside them are drawn once, the edges between them laid along the box.
        </p>
        <Stretcher borders={borders.map((one) => one.name)} fills={fills.map((one) => one.name)} />
      </Part>

      <Part title="Every border at three sizes">
        <p className="ui-label showcase__lead">
          As it was painted, as a card, and as wide as the sheet. The moodboard’s samples were not drawn to be
          sliced, so what is in the middle of an edge - a cross, a flask - stretches with it; that is what an
          embellishment is for.
        </p>
        {borders.map((picture) => (
          <Specimens key={picture.name}>
            <Specimen name={picture.name} note={`as painted, ${picture.width}×${picture.height}`}>
              <Box border={picture.name} width={picture.width} height={picture.height} />
            </Specimen>
            <Specimen name={picture.name} note="a card, 240×150">
              <Box border={picture.name} width={240} height={150}>
                <span className="showcase__box-label">content</span>
              </Box>
            </Specimen>
            <Specimen name={picture.name} note="the sheet’s width" wide>
              <Box border={picture.name} width="100%" height={180}>
                <span className="showcase__box-label">content</span>
              </Box>
            </Specimen>
          </Specimens>
        ))}
      </Part>

      <Part title="Fills">
        <p className="ui-label showcase__lead">
          Each laid at the size it is shown and repeated, so a seam would be a line every tile: none should
          show.
        </p>
        <Specimens>
          {fills.map((picture) => (
            <Specimen
              key={picture.name}
              name={picture.name}
              note={`repeats every ${picture.width} pixels`}
              wide
            >
              <div className="showcase__fill-sample">
                <FillLayer name={picture.name} />
              </div>
            </Specimen>
          ))}
        </Specimens>
      </Part>

      <Part title="At Windows’ scaling">
        <p className="ui-label showcase__lead">
          The same border at 100, 125, 150 and 200 per cent. At the two between, an edge’s pixels fall between
          the screen’s, which is where nine-slice shows hairline seams if it is going to. The browser still
          picks the picture for this screen, so the larger ones are soft; it is the seams to look at.
        </p>
        {['gilt-simple', 'gilt-drape'].map((name) => (
          <div key={name} className="showcase__scalings">
            {SCALINGS.map((scaling) => (
              <Specimen key={scaling} name={name} note={`${Math.round(scaling * 100)} per cent`}>
                <div style={{ zoom: scaling }}>
                  <Box
                    border={name}
                    fill={name === 'gilt-simple' ? 'parchment' : undefined}
                    width={150}
                    height={96}
                  />
                </div>
              </Specimen>
            ))}
          </div>
        ))}
      </Part>
    </>
  );
}

/** One box to drag to any size, with its border, fill and repeat to choose, and its cuts drawn over it. */
function Stretcher({ borders, fills }: { borders: readonly string[]; fills: readonly string[] }) {
  const [border, setBorder] = useState('gilt-simple');
  const [fill, setFill] = useState('parchment');
  const [repeat, setRepeat] = useState<Repeat | 'as its file says'>('as its file says');
  const [cuts, setCuts] = useState(true);
  const [size, setSize] = useState({ width: 360, height: 220 });
  const holder = useRef<HTMLDivElement>(null);

  // A drag on the corner resizes the box itself, so its size is read back from it rather than set.
  useEffect(() => {
    const box = holder.current;
    if (box === null) {
      return;
    }
    const watch = new ResizeObserver(() => {
      const width = Math.round(box.offsetWidth);
      const height = Math.round(box.offsetHeight);
      setSize((was) => (was.width === width && was.height === height ? was : { width, height }));
    });
    watch.observe(box);
    return () => watch.disconnect();
  }, []);

  return (
    <div className="showcase__stretcher">
      <div className="showcase__controls">
        <label>
          border{' '}
          <select value={border} onChange={(event) => setBorder(event.target.value)}>
            {borders.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          fill{' '}
          <select value={fill} onChange={(event) => setFill(event.target.value)}>
            <option value="">none: the border’s own middle</option>
            {fills.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          repeat{' '}
          <select
            value={repeat}
            onChange={(event) => setRepeat(event.target.value as Repeat | 'as its file says')}
          >
            <option>as its file says</option>
            {REPEATS.map((one) => (
              <option key={one}>{one}</option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={cuts} onChange={(event) => setCuts(event.target.checked)} /> cuts
        </label>
      </div>
      <div className="showcase__controls">
        {SIZES.map((one) => (
          <button
            key={`${one.width}x${one.height}`}
            type="button"
            className="showcase__choice-option"
            aria-pressed={size.width === one.width && size.height === one.height}
            onClick={() => setSize(one)}
          >
            {one.width}×{one.height}
          </button>
        ))}
        <span className="showcase__density">
          {size.width}×{size.height}
        </span>
      </div>
      <div ref={holder} className="showcase__resizable" style={{ width: size.width, height: size.height }}>
        <Box
          border={border}
          {...(fill === '' ? {} : { fill })}
          width="100%"
          height="100%"
          cuts={cuts}
          {...(repeat === 'as its file says' ? {} : { repeat: [repeat, repeat] as const })}
        >
          <span className="showcase__box-label">content starts here</span>
        </Box>
      </div>
    </div>
  );
}
