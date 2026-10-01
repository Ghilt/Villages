import './dots.css';

import { pictureIn, sourcesOf, usePictures } from '../art/pictures';
import type { Showing } from '../button/Button';

/** The pictures a dot is drawn in: a gilt ring for each thing, and a gilt ball for the one being shown. */
const ART = { dot: 'dot', at: 'dot-at' } as const;

/** How big a dot is drawn, and the room a finger is given to press one by. */
export const DOT_SIZE = 12;

/**
 * A dot for each of a few things and the one being shown lit: under a carousel, as the moodboard has them
 * between its arrows. A gilt ring each, and a gilt ball for the one shown.
 *
 * Given `onAt`, each dot is a button that goes to its thing, with room enough round it for a finger, and
 * says which it is - "2 of 5" - and which is shown; without, the dots are a picture of where in the run
 * the one shown is, said as one. See docs/UI-COMPONENTS.md.
 */
export function Dots({
  count,
  at,
  onAt,
  label,
  showing,
}: {
  count: number;
  /** Which is being shown, from nought. */
  at: number;
  /** Going to one, when they can be pressed. */
  onAt?: (at: number) => void;
  /** What the dots go between, for a screen reader: "Which option". */
  label: string;
  /** Draw every dot but the one shown as if hovered or focused: for the page, never for the game. */
  showing?: Exclude<Showing, 'pressed'>;
}) {
  const ones = Array.from({ length: count }, (_, one) => one);
  if (onAt === undefined) {
    return (
      <span className="ui-dots" role="img" aria-label={`${label}: ${at + 1} of ${count}`}>
        {ones.map((one) => (
          <span key={one} className={one === at ? 'ui-dots__dot ui-dots__dot--shown' : 'ui-dots__dot'}>
            <Dot shown={one === at} />
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="ui-dots" role="group" aria-label={label}>
      {ones.map((one) => (
        <button
          key={one}
          type="button"
          className={`ui-dots__dot ui-dots__dot--press${one === at ? ' ui-dots__dot--shown' : ''}`}
          aria-label={`${one + 1} of ${count}`}
          onClick={() => onAt(one)}
          {...(one === at ? { 'aria-current': true } : {})}
          {...(showing === undefined || one === at ? {} : { 'data-showing': showing })}
        >
          <Dot shown={one === at} />
        </button>
      ))}
    </span>
  );
}

function Dot({ shown }: { shown: boolean }) {
  const { list } = usePictures();
  const name = shown ? ART.at : ART.dot;
  const picture = pictureIn(list, 'controls', name);
  if (picture === undefined) {
    return (
      <span
        className="ui-dots__picture ui-dots__picture--missing"
        title={`no face called ${name}`}
        aria-hidden
      />
    );
  }
  const { src, srcSet } = sourcesOf(picture);
  return (
    <img
      className="ui-dots__picture"
      src={src}
      srcSet={srcSet}
      width={DOT_SIZE}
      height={DOT_SIZE}
      alt=""
      draggable={false}
    />
  );
}
