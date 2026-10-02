import './grid.css';

import { Children, isValidElement } from 'react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * A grid: things of one kind in rows and columns, every cell the same width - the key figures, a board of
 * pictures. As many across as it is told, or as many as fit at the narrowest a cell may be, and a card in
 * it is as tall as the tallest in its row.
 *
 * Told how many rows as well, it **never scrolls**: every cell is sized so that all of them fit the room
 * the grid is given, whichever of its width and its height is the tighter, and keeps the shape it is
 * told - the key figures' three by three. A cell is that size however many things there are, so a fourth
 * never rearranges the first three. A grid like that has to be given a height, which it fills; it works
 * its cells out in container units, as the game's key figures do, so nothing is measured and nothing
 * waits on a frame. See docs/UI-COMPONENTS.md.
 */
export function Grid({
  children,
  columns,
  least = 140,
  rows,
  shape = 3 / 4,
  gap = 8,
  label,
}: {
  /** The things, one to a cell, in the order given. */
  children: ReactNode;
  /** How many across; nothing, and as many as fit at `least` pixels wide. */
  columns?: number;
  /** The narrowest a cell is, in pixels, when the grid works out how many fit. */
  least?: number;
  /** How many down, with `columns`: the grid fits them all in the room it is given and never scrolls. */
  rows?: number;
  /** A cell's width over its height, in a grid that fits: what the card in it is drawn to. */
  shape?: number;
  /** Between the cells, in pixels. */
  gap?: number;
  /** What a screen reader calls the list it is. */
  label?: string;
}) {
  const cells = Children.toArray(children).map((child, at) => (
    <li key={isValidElement(child) && child.key !== null ? child.key : at} className="ui-grid__cell">
      {child}
    </li>
  ));
  if (columns !== undefined && rows !== undefined) {
    const style = {
      '--ui-grid-columns': columns,
      '--ui-grid-rows': rows,
      '--ui-grid-shape': shape,
      '--ui-grid-gap': `${gap}px`,
    } as CSSProperties;
    return (
      <div className="ui-grid-room">
        <ul className="ui-grid ui-grid--fit" style={style} role="list" aria-label={label}>
          {cells}
        </ul>
      </div>
    );
  }
  const across =
    columns === undefined
      ? `repeat(auto-fill, minmax(min(${least}px, 100%), 1fr))`
      : `repeat(${columns}, minmax(0, 1fr))`;
  return (
    <ul className="ui-grid" style={{ gridTemplateColumns: across, gap }} role="list" aria-label={label}>
      {cells}
    </ul>
  );
}
