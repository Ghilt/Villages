import './medallion.css';

import type { ReactNode } from 'react';

import { pictureIn, sourcesOf, usePictures } from '../art/pictures';

/**
 * A medallion: a round or oval frame, one fixed picture and never sliced - a portrait's oval, a house's
 * shield, the compass. Where its frame is clear inside itself, it has a window, and the `picture` it is
 * given shows through it: a key figure's portrait in the oval, covering the window and cut to its round.
 * Where it is painted whole it is an emblem, and holds nothing.
 *
 * Drawn `size` pixels tall, as wide as its picture is for that. The window is found by `npm run world:ui`
 * from the picture itself, so a frame painted with a clear middle is all it needs. Without a picture, a
 * window is dark glass. Its `label` is what it is for a screen reader: the figure's name, the house's.
 * See docs/UI-COMPONENTS.md.
 */
export function Medallion({
  name,
  size = 96,
  picture,
  label,
}: {
  /** A picture in `world/ui/medallions/`, by its name. */
  name: string;
  /** How tall it is drawn, in pixels. */
  size?: number;
  /** What its window holds: an `<img>`, or a portrait the game draws, covering it. */
  picture?: ReactNode;
  /** What it is, for a screen reader; without it, it is a picture beside words that say so already. */
  label?: string;
}) {
  const { list } = usePictures();
  const medallion = pictureIn(list, 'medallions', name);
  const said = label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label };
  if (medallion === undefined) {
    return (
      <span
        className="ui-medallion ui-medallion--missing"
        style={{ width: size, height: size }}
        title={`no medallion called ${name}`}
        {...said}
      />
    );
  }
  const width = Math.round((size * medallion.width) / medallion.height);
  const { src, srcSet } = sourcesOf(medallion);
  const opening = medallion.window;
  return (
    <span className="ui-medallion" style={{ width, height: size }} {...said}>
      {opening !== undefined && (
        <span
          className="ui-medallion__window"
          style={{
            left: `${opening.left * 100}%`,
            top: `${opening.top * 100}%`,
            width: `${opening.width * 100}%`,
            height: `${opening.height * 100}%`,
          }}
        >
          {picture}
        </span>
      )}
      <img
        className="ui-medallion__frame"
        src={src}
        srcSet={srcSet}
        width={width}
        height={size}
        alt=""
        draggable={false}
      />
    </span>
  );
}
