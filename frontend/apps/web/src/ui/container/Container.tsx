import './container.css';

import type { CSSProperties, ReactNode } from 'react';

import { pictureIn, sourcesOf, usePictures } from '../art/pictures';
import { BorderLayer, FillLayer } from '../border/Border';
import { sidesInPixels } from '../border/borderStyle';
import { layoutOf } from './layout';
import type { Placed, Recipe } from './layout';
import { RECIPES } from './recipes';
import type { RecipeName } from './recipes';

/**
 * Any boxed thing in the interface - a pane, a card, a dialog, a tooltip - as four layers: a **border**,
 * a **fill**, none or several **embellishments**, and the content. Named by a **recipe**, so a pane says
 * which it is rather than how it is drawn, and a container inside a container is two of them.
 *
 * It is as wide as whatever holds it and as tall as its content, which is set in by the border's cut and
 * inset and the recipe's padding. An embellishment takes none of the content's room: it stands where it
 * is pinned, over the border or out past the box, and a margin as wide as its overhang keeps the
 * container's neighbours clear of it. See docs/UI-COMPONENTS.md.
 */
export function Container({
  recipe,
  children,
  className,
  style,
}: {
  recipe: RecipeName | Recipe;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const given: Recipe = typeof recipe === 'string' ? RECIPES[recipe] : recipe;
  const { list } = usePictures();
  const border = given.border === undefined ? undefined : pictureIn(list, 'borders', given.border)?.border;
  const layout = layoutOf(given, border, (art) => pictureIn(list, 'embellishments', art));
  const classes = ['ui-container', given.text === 'ink' ? 'ui-on-parchment' : '', className ?? '']
    .filter((one) => one !== '')
    .join(' ');
  return (
    <div
      className={classes}
      style={{ margin: sidesInPixels(layout.margin), ...style }}
      {...(typeof recipe === 'string' ? { 'data-recipe': recipe } : {})}
    >
      {given.fill !== undefined && <FillLayer name={given.fill} inset={layout.fillInset} />}
      {layout.placed
        .filter((placed) => placed.embellishment.behind === true)
        .map((placed, at) => (
          <EmbellishmentLayer key={`behind-${at}`} placed={placed} />
        ))}
      {given.border !== undefined && (
        <BorderLayer name={given.border} {...(given.fill === undefined ? {} : { middle: false })} />
      )}
      <div className="ui-container__content" style={{ padding: sidesInPixels(layout.padding) }}>
        {children}
      </div>
      {layout.placed
        .filter((placed) => placed.embellishment.behind !== true)
        .map((placed, at) => (
          <EmbellishmentLayer key={`over-${at}`} placed={placed} />
        ))}
    </div>
  );
}

function EmbellishmentLayer({ placed }: { placed: Placed }) {
  const { list } = usePictures();
  const picture = pictureIn(list, 'embellishments', placed.embellishment.art);
  if (picture === undefined) {
    return null;
  }
  const { src, srcSet } = sourcesOf(picture);
  return (
    <img
      className={`ui-embellishment${placed.embellishment.behind === true ? ' ui-embellishment--behind' : ''}`}
      src={src}
      srcSet={srcSet}
      width={placed.width}
      height={placed.height}
      style={placed.place}
      alt=""
      draggable={false}
    />
  );
}
