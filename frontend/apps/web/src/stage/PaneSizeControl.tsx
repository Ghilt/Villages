import type { PaneSize, Room } from './panes';

/**
 * **The pane size control**: how much of the stage this pane is taking, and the way to change it.
 *
 * **One control on every pane**, in both forms, replacing the chevron that used to only put a pane away.
 * Put away, the normal one, opened out - three marks, the one you are on filled in. Three on every pane
 * since 0046 gave the map a strip, but for the letter in the spread, which is put away or opened out (0085).
 *
 * The mark is how much of a box is filled, which is the thing being chosen: a sliver, some of it, all of
 * it. That is deliberately not a metaphor - there is no folder, no chevron, no arrow pointing anywhere. A
 * player reads it as a slider they can hit the ends of. See decision record 0045.
 *
 * It sits in the pane's top corner, out of the way of whatever the pane draws, and steps clear of the
 * compass when the compass is standing in that corner. A pane taking turns in a tile draws none: the tab
 * bar above it carries one for the tile, and this draws nothing when it is handed a room that says so.
 */

/** How much of the mark's box is filled, at each size. The box is 14 tall inside its outline. */
const FILLED: Record<PaneSize, { y: number; h: number }> = {
  strip: { y: 15.5, h: 3.5 },
  small: { y: 11, h: 8 },
  full: { y: 5, h: 14 },
};

const SAID: Record<PaneSize, string> = {
  strip: 'put away',
  small: 'the normal size',
  full: 'opened out',
};

export function PaneSizeControl({ room }: { room: Room }) {
  if (!room.ownControl) {
    return null;
  }
  return (
    <span className="pane-size" role="group" aria-label="how much room this takes">
      {room.sizes.map((size) => {
        const on = room.asked === size;
        const box = FILLED[size];
        return (
          <button
            key={size}
            type="button"
            className={on ? 'pane-size__one pane-size__one--on' : 'pane-size__one'}
            aria-pressed={on}
            aria-label={SAID[size]}
            title={SAID[size]}
            onClick={() => room.ask(size)}
          >
            <svg className="icon" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
              <rect x="5" y="5" width="14" height="14" rx="1.6" className="icon__line" />
              <rect x="5" y={box.y} width="14" height={box.h} rx="1.6" className="icon__fill" />
            </svg>
          </button>
        );
      })}
    </span>
  );
}
