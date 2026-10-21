import './diorama.css';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { fitOf, standing } from './dioramaFit';
import type { Frame, Size } from './dioramaFit';

/** A sheet of pictures, as the map's atlases are: where to fetch it, and how big it is. */
export interface Sheet {
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

/**
 * One of the map's pictures standing in the scene: cut from its sheet, `height` units tall, its foot - a share of its
 * frame across and down - at (x, y). There is no way to turn it round: a building is never mirrored, because its light
 * would move to the upper left (decision record 0116).
 */
export interface Standing {
  readonly id: string;
  readonly sheet: Sheet;
  readonly frame: Frame;
  readonly foot: { readonly x: number; readonly y: number };
  readonly x: number;
  readonly y: number;
  readonly height: number;
  /** How seen it is, from 0 to 1: a thing not yet arrived is 0, and fades in. */
  readonly seen?: number;
}

/** Anything else standing in the scene, drawn by whoever gives it, its box's bottom middle on (x, y). */
export interface Placed {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly node: ReactNode;
  /** In front of what is behind it by its foot unless told otherwise. */
  readonly depth?: number;
  /** Seconds it takes to walk to where it is next put; none, and it is there at once. */
  readonly walk?: number;
}

/**
 * A diorama: a small piece of the world drawn as the map draws it, seen from the south and above, in a scene of its own
 * units scaled to its box - covering it, or standing whole inside it. The ground lies under everything; the map's own
 * pictures and whatever else is placed stand on their feet, each in front of whatever stands behind it, its foot
 * further down the scene. What is placed walks to where it is next put. See docs/UI-COMPONENTS.md and decision record
 * 0116.
 */
export function Diorama({
  scene,
  ground,
  pictures,
  placed,
  fit = 'cover',
  label,
}: {
  scene: Size;
  /** Drawn under everything, in the scene's units: the ground, a floor and its walls. */
  ground?: ReactNode;
  pictures: readonly Standing[];
  placed: readonly Placed[];
  fit?: 'cover' | 'contain';
  label?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const element = box.current;
    if (element === null) {
      return undefined;
    }
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(element);
    return () => watch.disconnect();
  }, []);
  const { scale, left, top } = fitOf(scene, size, fit);
  return (
    <div ref={box} className="ui-diorama" role="img" aria-label={label}>
      <div
        className="ui-diorama__scene"
        style={{
          width: scene.width,
          height: scene.height,
          transform: `translate(${left}px, ${top}px) scale(${scale})`,
        }}
      >
        {ground !== undefined && <div className="ui-diorama__ground">{ground}</div>}
        {pictures.map((picture) => {
          const at = standing(picture.frame, picture.foot, picture, picture.height);
          const shown = picture.height / picture.frame.height;
          return (
            <span
              key={picture.id}
              className="ui-diorama__picture"
              style={{
                left: at.left,
                top: at.top,
                width: at.width,
                height: at.height,
                zIndex: Math.round(picture.y),
                opacity: picture.seen ?? 1,
                backgroundImage: `url(${picture.sheet.src})`,
                backgroundSize: `${picture.sheet.width * shown}px ${picture.sheet.height * shown}px`,
                backgroundPosition: `${-picture.frame.x * shown}px ${-picture.frame.y * shown}px`,
              }}
            />
          );
        })}
        {placed.map((one) => (
          <span
            key={one.id}
            className="ui-diorama__placed"
            style={{
              left: one.x,
              top: one.y,
              zIndex: Math.round(one.depth ?? one.y),
              transition:
                one.walk === undefined
                  ? undefined
                  : `left ${one.walk}s ease-in-out, top ${one.walk}s ease-in-out`,
            }}
          >
            <span className="ui-diorama__foot">{one.node}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
