import './mark.css';

import type { ReactNode } from 'react';

import { pictureIn, sourcesOf, usePictures } from '../art/pictures';

/**
 * A mark: a small sign a thing is known by where there is no room for its name - a close, an eye, a step.
 *
 * **Drawn or painted, one mark at a time.** Every mark has a drawing here, stroked at the weight every mark
 * in the interface is drawn at, and a painted picture in `world/ui/marks/` by the same name is drawn
 * instead of it wherever there is one. So a mark is painted by saving a picture, and drawn again by
 * deleting it. See decision record 0068 and docs/UI-COMPONENTS.md.
 */

/** The eye, open and shut: one almond in both, as the house's own eye has it, so the mark does not change. */
const EYE = {
  almond: 'M2.2 12 C6 6.2 18 6.2 21.8 12 C18 17.8 6 17.8 2.2 12 Z',
  lid: 'M2.8 10.4 C6.5 15.8 17.5 15.8 21.2 10.4',
  lashes: ['M5.2 13.9 L3.5 16.6', 'M9.2 15.6 L8.4 18.6', 'M14.8 15.6 L15.6 18.6', 'M18.8 13.9 L20.5 16.6'],
} as const;

/** Every mark the library draws itself, on a square of 24. */
const DRAWN = {
  // Two strokes crossed, shorter than the box, because corner to corner reads as a deletion.
  close: <path d="M7 7 L17 17 M17 7 L7 17" className="ui-mark__line" />,
  minimise: <path d="M6 12 H18" className="ui-mark__line" />,
  maximise: <path d="M6.5 6.5 H17.5 V17.5 H6.5 Z" className="ui-mark__line" />,
  // A step back and a step on: what a carousel's arrows do, which is not what the needle means.
  previous: <path d="M14.5 5.5 L8 12 L14.5 18.5" className="ui-mark__line" />,
  next: <path d="M9.5 5.5 L16 12 L9.5 18.5" className="ui-mark__line" />,
  'eye-open': (
    <>
      <path d={EYE.almond} className="ui-mark__line" />
      <circle cx="12" cy="12" r="3.2" className="ui-mark__fill" />
    </>
  ),
  'eye-shut': (
    <>
      <path d={EYE.lid} className="ui-mark__line" />
      {EYE.lashes.map((lash) => (
        <path key={lash} d={lash} className="ui-mark__line" />
      ))}
    </>
  ),
} satisfies Record<string, ReactNode>;

export type MarkName = keyof typeof DRAWN;

export const MARK_NAMES = Object.keys(DRAWN) as MarkName[];

export function Mark({
  name,
  size = 24,
  title,
}: {
  name: MarkName;
  /** How big it is drawn, in pixels, both ways. */
  size?: number;
  /** What it means, for anyone reading the page rather than looking at it; left out when words are beside it. */
  title?: string;
}) {
  const { list } = usePictures();
  const painted = pictureIn(list, 'marks', name);
  if (painted !== undefined) {
    const { src, srcSet } = sourcesOf(painted);
    return (
      <img
        className="ui-mark ui-mark--painted"
        src={src}
        srcSet={srcSet}
        width={size}
        height={size}
        alt={title ?? ''}
        draggable={false}
      />
    );
  }
  return (
    <svg
      className="ui-mark"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...(title === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': title })}
    >
      {DRAWN[name]}
    </svg>
  );
}
