import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { note } from '../debug/log';
import { subjectsNow, watchSubjects } from '../inspect/subjects';
import { Kebab } from './Kebab';
import { bayLayout, type BayName, type Box, isTabbed, type Rect, TAB_BAR, TILES } from './bayBox';
import {
  askingNow,
  baysNow,
  formNow,
  show,
  showingIn,
  stageIs,
  toggleMinimise,
  type Which,
  watchBays,
} from './bays';
import { FIXED_PANES, type Pane, panesFor, panesIn, type Room, sizeOf, spreadWants } from './panes';
import { TabBar } from './TabBar';

/**
 * The stage, and how it divides itself.
 *
 * **The spread is tiles on a map**: the map is the floor, filling the stage and lying under everything, and
 * a column down the side holds the rail above the house. **The bays are two boxes** cut along the stage's
 * longer side, which is what a phone gets. The whole difference between the forms is that the spread shows
 * everything at once and the bays choose. See decision records 0040 and 0041.
 *
 * Every bay is a rectangle from `bayBox`, in both forms, and this component only places what it is handed.
 * That is what makes "the tiles never overlap" a thing a test says rather than a thing the CSS is trusted
 * with, and it is what lets the camera be told which part of the map is actually visible.
 *
 * **Nothing is unmounted to move it, and nothing moves in the tree.** A pane changes bays by having a
 * different rectangle written into its wrapper's style, and the wrappers are the same elements in the same
 * order whatever the layout says. That matters for exactly one pane and it matters a lot: `MapView` calls
 * `map.remove()` when it unmounts, and MapLibre holds the camera, the style and a WebGL context, with the
 * sprite overlay's Pixi canvas beside it.
 *
 * A pane is handed the room it got and nothing else. It never learns which bay it is in, which is what lets
 * a mechanic be written once and drawn at up to three sizes.
 */

interface StageProps {
  /** How big the stage is, from `stageBox`. */
  stage: Box;
  /**
   * What each pane draws, given the room it got and how the stage is cut.
   *
   * `along` is null in the spread, where there are no bays to choose between and a link is a plain click.
   */
  contents: (id: string, room: Room, along: 'rows' | 'columns' | null) => ReactNode;
  /** Over the top of everything and in no bay: the parchment, and the notice that you were stood down. */
  overlays?: ReactNode;
}

/** A rectangle as the four numbers that place an absolutely positioned box. */
function place(rect: Rect): CSSProperties {
  return { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` };
}

export function Stage({ stage, contents, overlays }: StageProps) {
  const bays = useSyncExternalStore(watchBays, baysNow);
  const asking = useSyncExternalStore(watchBays, askingNow);
  const subjects = useSyncExternalStore(watchSubjects, subjectsNow);
  const panes = useMemo(() => panesFor(subjects.open), [subjects.open]);
  const wants = useMemo(() => spreadWants(panes, bays.minimised, showingIn), [panes, bays]);

  // `formNow()` is the form the stage was in a moment ago, which is what gives the fold its dead band. It
  // is read rather than passed because the layout is what sets it, and it only ever changes as a result of
  // one of the things this memo already depends on - so a cached answer is never stale.
  const box = useMemo(() => bayLayout(stage, asking, wants, formNow()), [stage, asking, wants]);

  // The manager asks this when it needs to know whether putting a window somewhere means anything, and to
  // say "top" rather than "the first bay" in the log.
  stageIs(box.form, box.along);

  // One line when the stage crosses the fold or turns on its side, and none while it is merely being
  // resized: a drag that changes nothing is not news. See decision record 0023.
  const said = useRef('');
  useEffect(() => {
    const now = `${box.form}/${box.along}`;
    if (said.current !== now) {
      said.current = now;
      const cut = box.along === 'rows' ? 'a top and a bottom' : 'a left and a right';
      note(
        'shape',
        box.form === 'bays'
          ? `two bays, ${cut}, stage ${stage.w} by ${stage.h}`
          : `the spread, stage ${stage.w} by ${stage.h}`,
      );
    }
  }, [box.form, box.along, stage.w, stage.h]);

  /**
   * Which bay a pane is in.
   *
   * In the spread the pane said so itself when it was declared; in the bays it is wherever the manager put
   * it. Null means nowhere, which is a pane the player has not got up.
   */
  const bayOf = (id: string, pane: Pane | undefined): BayName | null => {
    if (box.form === 'spread') {
      return pane?.spread ?? null;
    }
    const at = bays.holding.indexOf(id);
    return at === 0 ? 'first' : at === 1 ? 'second' : null;
  };

  const bayFor = (id: string) => {
    const pane = panes.find((one) => one.id === id);
    const where = bayOf(id, pane);
    const at = bays.holding.indexOf(id);
    const shut = bays.minimised.has(id);
    const room: Room = {
      size: sizeOf(box.form, at === -1 ? 'big' : asking[at as Which], shut),
      // Minimise is a property of a pane everywhere, not a feature of the small screen: the same button
      // works in the spread, where collapsing the house gives the column's room back to the rail.
      minimise: pane?.strip == null ? null : () => toggleMinimise(id),
    };

    // A window in the spread stacks inside the rail, which is itself the column's upper tile, so it is a
    // flow item rather than a box of its own. Everything else is placed by its rectangle.
    const railed = box.form === 'spread' && where === 'left';
    // Panes sharing this tile behind a tab bar, if any. Only the one that is up is drawn, and it starts
    // below the strip of tabs rather than at the tile's own top edge.
    const sharing = where === null || box.form !== 'spread' ? [] : panesIn(panes, where);
    const tabbed = isTabbed(where, sharing.length);
    const up = !tabbed || showingIn(where as BayName, sharing).id === id;
    const whole = where === null ? null : box.bays[where];
    const rect =
      whole !== null && tabbed
        ? { ...whole, y: whole.y + TAB_BAR, h: Math.max(0, whole.h - TAB_BAR) }
        : whole;

    return (
      <div
        className={`bay bay--${kindOf(id)} bay--${room.size}`}
        key={id}
        data-at={where ?? 'nowhere'}
        data-tabbed={tabbed ? 'yes' : undefined}
        hidden={!railed && (rect === null || !up)}
        style={railed || rect === null ? undefined : place(rect)}
      >
        {contents(id, room, box.form === 'bays' ? box.along : null)}
      </div>
    );
  };

  const rail = box.form === 'spread' ? box.bays.left : null;

  // A tile that more than one pane declared itself into gets a strip of tabs across its top. There is one
  // such tile today - the corner, holding the house status and navigation - and the layout learns only that
  // the tile is `TAB_BAR` taller than whatever is up in it. See decision record 0042.
  const tabbedTiles =
    box.form === 'spread'
      ? TILES.filter((name) => box.bays[name] !== null && isTabbed(name, panesIn(panes, name).length))
      : [];

  // Where the seam between the two bays is, for the one thing that sits on it rather than in a bay.
  const first = box.bays.first;
  const seam = first === null ? '50%' : `${box.along === 'rows' ? first.h : first.w}px`;

  return (
    <div
      className="stage"
      data-form={box.form}
      data-along={box.along}
      style={{ '--bay-first': seam } as CSSProperties}
    >
      {FIXED_PANES.map((pane) => bayFor(pane.id))}

      {/*
       * The rail: where inspect windows stack in the spread, up to three, newest at the top.
       *
       * In the spread it *is* the column's upper tile, and the windows inside it are flow items sharing
       * that one rectangle - which is why three of them can never push past the house in the corner. In
       * the bays it is `display: contents`, so each window is a box in its own right and nothing is
       * remounted crossing the fold: the same trick that keeps the map alive, for the same reason.
       */}
      <div
        className="rail"
        hidden={box.form === 'spread' && rail === null}
        style={rail === null ? undefined : place(rail)}
      >
        {panes.filter(isWindow).map((pane) => bayFor(pane.id))}
      </div>

      {/* The game's own name, over the floor and never over a tile. It left the house card when the card
          became a tile in the corner: it is the world's name rather than the house's, and it was only ever
          in there because the house card used to be the whole stage. */}
      {box.form === 'spread' && <p className="stage__title">Villages</p>}

      {tabbedTiles.map((name) => {
        const sharing = panesIn(panes, name);
        const tile = box.bays[name]!;
        return (
          <TabBar
            key={name}
            sharing={sharing}
            showing={showingIn(name, sharing).id}
            onShow={(id) => show(name, id)}
            style={place({ ...tile, h: TAB_BAR })}
          />
        );
      })}

      {box.form === 'bays' && <Kebab along={box.along} />}
      {overlays}
    </div>
  );
}

const isWindow = (pane: { id: string }) => pane.id.startsWith('inspect:');

/** The class a bay gets from what is in it: every inspect window is styled the same way. */
function kindOf(id: string): string {
  return id.startsWith('inspect:') ? 'inspect' : id;
}
