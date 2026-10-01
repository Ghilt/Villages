import './border.css';

import type { Repeat, Sides } from '@villages/world';

import { pictureIn, usePictures } from '../art/pictures';
import { borderImageOf, fillImageOf } from './borderStyle';

/**
 * The two bottom layers of a container: the **border**, a nine-slice picture laid round the box it is in,
 * and the **fill** inside it. Each is absolutely placed in whatever box holds it, which has to be
 * positioned, and takes no pointer: what is under them is the content, not them.
 *
 * Asked for by name, so the picture Adam saves over a placeholder is the one drawn. A picture that is not
 * cut - a name nothing in `world/ui/` has, or a page with no pictures yet - is drawn as a dashed outline,
 * because a missing border should be seen missing rather than quietly be no border. See
 * docs/UI-COMPONENTS.md and decision record 0068.
 */

export function BorderLayer({
  name,
  middle,
  repeat,
  scale,
}: {
  /** A picture in `world/ui/borders/`, by its name. */
  name: string;
  /** Draw the picture's own middle, whatever its file says. */
  middle?: boolean;
  /** Lay its edges this way, whatever its file says. */
  repeat?: readonly [Repeat, Repeat];
  /** Draw it this many times the size its picture is shown. */
  scale?: number;
}) {
  const { list } = usePictures();
  const picture = pictureIn(list, 'borders', name);
  if (picture?.border === undefined) {
    return <div className="ui-border ui-border--missing" title={`no border called ${name}`} aria-hidden />;
  }
  const options = {
    ...(middle === undefined ? {} : { middle }),
    ...(repeat === undefined ? {} : { repeat }),
    ...(scale === undefined ? {} : { scale }),
  };
  return <div className="ui-border" style={borderImageOf(picture, picture.border, options)} aria-hidden />;
}

export function FillLayer({
  name,
  inset = [0, 0, 0, 0],
}: {
  /** A picture in `world/ui/fills/`, by its name. */
  name: string;
  /** How far in from each edge of the box the fill stands: `fillInsetOf` the border round it. */
  inset?: Sides;
}) {
  const { list } = usePictures();
  const picture = pictureIn(list, 'fills', name);
  const [top, right, bottom, left] = inset;
  const place = { top, right, bottom, left };
  if (picture === undefined) {
    return (
      <div className="ui-fill ui-fill--missing" style={place} title={`no fill called ${name}`} aria-hidden />
    );
  }
  return <div className="ui-fill" style={{ ...place, ...fillImageOf(picture) }} aria-hidden />;
}
