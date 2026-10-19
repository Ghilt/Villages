import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import '../ui/ui.css';

import { note } from '../log/log';
import { Container } from '../ui/container/Container';
import { Compass } from './Compass';
import { dressOf } from './dress';
import { Seam } from './Seam';
import { bayLayout, type BayName, type Box, isTabbed, type Rect, TAB_BAR, TILES } from './bayBox';
import { baysStore, askFor, formNow, putAwayForRoom, show, showingIn, stageIs } from './bays';
import { openBeside, showMapBeside } from './arrive';
import { askedIn, askingOf, type Which } from './arrangement';
import {
  cramps,
  type Pane,
  type PaneDef,
  panesIn,
  type PaneSize,
  type Room,
  sizeAsked,
  SIZES,
  sizeOf,
  spreadWants,
} from './panes';
import { outOfRoom } from './rail';
import { useGlideOnTheRail } from './railGlide';
import { openingOut } from './strip';
import { TabBar } from './TabBar';
import { useStore } from '../store/useStore';

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
   * Every pane there is, in order, each with what it draws given the room it got and how the stage is cut:
   * the ones standing, then a window per subject. Handed in, so that the stage reads nothing of the game. See
   * `panes.tsx` at the root.
   */
  panes: readonly PaneDef[];
  /** Over the top of everything and in no bay: the parchment, and the notice that you were stood down. */
  overlays?: ReactNode;
}

/** A rectangle as the four numbers that place an absolutely positioned box. */
function place(rect: Rect): CSSProperties {
  return { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` };
}

export function Stage({ stage, panes, overlays }: StageProps) {
  const bays = useStore(baysStore);
  const asking = useStore(baysStore, askingOf);
  // Not told which tab is up, which is what makes pressing one move nothing. See decision record 0057.
  const wants = useMemo(() => spreadWants(panes, bays), [panes, bays]);

  // `formNow()` is the form the stage was in a moment ago, which is what gives the fold its dead band. It
  // is read rather than passed because the layout is what sets it, and it only ever changes as a result of
  // one of the things this memo already depends on - so a cached answer is never stale.
  const box = useMemo(() => bayLayout(stage, asking, wants, formNow()), [stage, asking, wants]);

  // Whether the tiles may glide to where they are going, which they do in the spread whenever a size was asked
  // for: not while the stage itself is being resized or crossing the fold, when everything follows the window at
  // once and a glide would trail behind the grip. See decision record 0086.
  const was = useRef({ w: stage.w, h: stage.h, form: box.form });
  const easing = was.current.w === stage.w && was.current.h === stage.h && was.current.form === box.form;
  useLayoutEffect(() => {
    was.current = { w: stage.w, h: stage.h, form: box.form };
  });

  // The manager asks this when it needs to know whether putting a window somewhere means anything, and to
  // say "top" rather than "the first bay" in the log. Before any effect of the game's asks it.
  useLayoutEffect(() => stageIs(box.form, box.along), [box.form, box.along]);

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
    const whole = where === null ? null : box.bays[where];
    const at = bays.holding.indexOf(id);
    // Panes sharing this tile behind a tab bar, if any. Only the one that is up is drawn, and it starts
    // below the strip of tabs rather than at the tile's own top edge.
    const sharing = where === null || box.form !== 'spread' ? [] : panesIn(panes, where);
    const tabbed = isTabbed(where, sharing.length);
    const up = !tabbed || showingIn(where as BayName, sharing).id === id;
    // What the player asked for, and the two forms answer it from different places. A tile in the spread
    // has a size of its own - this pane's, or the tile's when its panes take turns in it - and a bay is
    // one end of a split, so it is whatever the arrangement makes of the end this pane is standing at. A
    // pane in no bay is hidden, so what it says there is never drawn.
    const asked: PaneSize =
      box.form === 'spread'
        ? pane === undefined
          ? 'full'
          : sizeAsked(pane, bays)
        : at === -1
          ? 'small'
          : askedIn(bays.arrangement, at as Which);
    const room: Room = {
      // The bay is a rectangle, so the layout caps what was asked for by what will actually fit, rather
      // than leaving a pane too big for its tile to grow a scrollbar inside it.
      size: sizeOf(asked, cramps(pane, whole)),
      asked,
      // One control on every pane, in both forms, except that the panes taking turns in a tile share the
      // one in its tab bar. See decision records 0045, 0046 and 0057.
      ask: pane?.ask ?? ((size) => askFor(id, size)),
      sizes: (box.form === 'spread' ? pane?.spreadSizes : undefined) ?? SIZES,
      ownControl: !tabbed,
      showMap: () => showMapBeside(id),
      openBeside: (other) => openBeside(id, other),
    };

    // Put away in the spread, a press anywhere on it opens it out, but on a button of its own: Adam's word of
    // 2026-10-06. The tab bar above the corner is its own and is not part of this.
    const away = box.form === 'spread' && room.size === 'strip';

    // A window in the spread stacks inside the rail, which is itself the column's upper tile, so it is a
    // flow item rather than a box of its own. Everything else is placed by its rectangle.
    const railed = box.form === 'spread' && where === 'left';
    const rect =
      whole !== null && tabbed
        ? { ...whole, y: whole.y + TAB_BAR, h: Math.max(0, whole.h - TAB_BAR) }
        : whole;

    return (
      <div
        className={`bay bay--${kindOf(id)}`}
        key={id}
        data-at={where ?? 'nowhere'}
        data-pane={id}
        data-tabbed={tabbed ? 'yes' : undefined}
        data-over={where !== null && where === box.over ? 'yes' : undefined}
        data-away={away ? 'yes' : undefined}
        onClick={away ? openingOut(() => room.ask('full')) : undefined}
        hidden={!railed && (rect === null || !up)}
        style={railed || rect === null ? undefined : place(rect)}
      >
        {dressed(pane, room.size, !railed, pane?.draw(room, box.form === 'bays' ? box.along : null))}
      </div>
    );
  };

  const rail = box.form === 'spread' ? box.bays.left : null;

  // Out of room, the rail keeps one pane open and puts the rest away. What each is drawn at depends on
  // what it says, so the stage measures the rail after every layout rather than working it out. See 0058.
  const railRef = useRef<HTMLDivElement | null>(null);
  const stacked = panes.filter(isWindow).map((pane) => ({ id: pane.id, asked: sizeAsked(pane, bays) }));
  useRoomOnTheRail(railRef, rail !== null, stacked);
  // And the windows on it glide, as the tiles do: see `railGlide.ts`.
  useGlideOnTheRail(
    railRef,
    easing && rail !== null,
    stacked.map((one) => `${one.id}:${one.asked}`).join(' '),
  );

  // A tile that more than one pane declared itself into gets a strip of tabs across its top. There is one
  // such tile today - the corner, holding the house status, the key figures and navigation - and the
  // layout learns only that the tile is `TAB_BAR` taller than its own size. The strip carries the tile's
  // one size control at its far end, because the tile is one size whichever tab is up. See decision
  // records 0042 and 0057.
  const tabbedTiles =
    box.form === 'spread'
      ? TILES.filter((name) => box.bays[name] !== null && isTabbed(name, panesIn(panes, name).length))
      : [];

  // What lies over everything else in the spread - the letter opened out - and the veil under it, which puts
  // it away when pressed: the world behind is dimmed rather than gone, and pressing it is the way back to it.
  const over = box.over === null ? undefined : panesIn(panes, box.over)[0];

  // Where the seam between the two bays is, for the one thing that sits on it rather than in a bay.
  const first = box.bays.first;
  const seam = first === null ? '50%' : `${box.along === 'rows' ? first.h : first.w}px`;

  return (
    <div
      className="stage"
      data-form={box.form}
      data-along={box.along}
      data-easing={easing ? 'yes' : undefined}
      style={{ '--bay-first': seam } as CSSProperties}
    >
      {panes.filter((pane) => !isWindow(pane)).map((pane) => bayFor(pane.id))}

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
        ref={railRef}
        hidden={box.form === 'spread' && rail === null}
        style={rail === null ? undefined : place(rail)}
      >
        {panes.filter(isWindow).map((pane) => bayFor(pane.id))}
      </div>

      {tabbedTiles.map((name) => {
        const sharing = panesIn(panes, name);
        const tile = box.bays[name]!;
        const up = showingIn(name, sharing);
        // The tile's own size, which every pane in it answers with; asking through whichever is up asks
        // the tile, because that is where `askFor` sends a pane that takes turns.
        const asked = sizeAsked(up, bays);
        const room: Room = {
          size: sizeOf(asked),
          asked,
          ask: (size) => askFor(up.id, size),
          sizes: up.spreadSizes ?? SIZES,
          ownControl: true,
          showMap: () => showMapBeside(up.id),
          openBeside: (other) => openBeside(up.id, other),
        };
        return (
          <TabBar
            key={name}
            dressed={dressOf(name) !== undefined}
            sharing={sharing}
            showing={up.id}
            onShow={(id) => show(name, id)}
            label={name === 'right' ? 'What is in this column' : 'What is in this corner'}
            room={room}
            style={place({ ...tile, h: TAB_BAR })}
          />
        );
      })}

      {/* Always there in the spread, so that it fades out as well as in; it takes no press while it is down. */}
      {box.form === 'spread' && (
        <div
          className="veil"
          aria-hidden="true"
          data-up={over === undefined ? undefined : 'yes'}
          onClick={over === undefined ? undefined : () => askFor(over.id, 'strip')}
        />
      )}

      {/* The moulding over the join, and the disc that stands on it. Only where there is a join:
          below 64 pixels the stage is one box and `--bay-first` is the whole of it. */}
      {box.form === 'bays' && box.bays.second !== null && <Seam along={box.along} />}
      {box.form === 'bays' && <Compass />}
      {overlays}
    </div>
  );
}

const isWindow = (pane: { id: string }) => pane.id.startsWith('inspect:');

/**
 * A pane in the container its tile is dressed in, open or put away; as it drew itself where its tile is not
 * dressed. Filling the tile, except in the rail, where a window is as tall as what it says.
 */
function dressed(pane: Pane | undefined, size: PaneSize, fills: boolean, drawn: ReactNode): ReactNode {
  const dress = pane === undefined ? undefined : dressOf(pane.spread);
  if (dress === undefined) {
    return drawn;
  }
  return (
    <Container recipe={size === 'strip' ? dress.strip : dress.open} fills={fills} className="ui-root dressed">
      {drawn}
    </Container>
  );
}

/** The class a bay gets from what is in it: every inspect window is styled the same way. */
function kindOf(id: string): string {
  return id.startsWith('inspect:') ? 'inspect' : id;
}

/**
 * Measure the rail and put away what it has no room for.
 *
 * After every layout, and whenever a pane on it changes height without the stage laying out again - a
 * window whose subject changed, a census that finished counting. Each pane is measured at the height it is
 * drawn at rather than the height it is squeezed to, which is what the rail would need to show it whole.
 * `outOfRoom` says which to put away; once one is open there is nothing more to say, so a measurement that
 * follows its own answer asks for nothing and it settles. See `rail.ts`.
 */
function useRoomOnTheRail(
  rail: RefObject<HTMLDivElement | null>,
  on: boolean,
  stacked: readonly { id: string; asked: PaneSize }[],
): void {
  const check = useRef(() => {});
  check.current = () => {
    const held = rail.current;
    if (!on || held === null) {
      return;
    }
    const drawn = [...held.children].map((bay) => bay.firstElementChild as HTMLElement | null);
    const measured = stacked.map((one, at) => ({ ...one, tall: wholeHeight(drawn[at]) }));
    const gap = Number.parseFloat(getComputedStyle(held).rowGap) || 0;
    putAwayForRoom(outOfRoom(measured, held.clientHeight, gap));
  };

  useLayoutEffect(() => {
    check.current();
    const held = rail.current;
    if (!on || held === null) {
      return;
    }
    // A pane squeezed into a scroll keeps its box when what it says grows, so watching the pane alone
    // misses exactly the case that matters. Its children keep their own heights, so they are watched
    // too, and anything added to or taken out of the rail's tree asks again.
    const resized = new ResizeObserver(() => check.current());
    // The rail itself too, because it glides to a new height when the corner below it changes size, and the
    // room on it is what it comes to rather than where it set out from.
    resized.observe(held);
    for (const bay of held.children) {
      const pane = bay.firstElementChild;
      if (pane !== null) {
        resized.observe(pane);
        for (const part of pane.children) {
          resized.observe(part);
        }
      }
    }
    const changed = new MutationObserver(() => check.current());
    changed.observe(held, { childList: true, subtree: true, characterData: true });
    return () => {
      resized.disconnect();
      changed.disconnect();
    };
  });
}

/**
 * How tall a pane is drawn whole: what it says plus its edges, whether or not a short rail is squeezing it
 * into a scroll. A pane that is not squeezed has as much to scroll as it shows, so this is its own height.
 */
function wholeHeight(drawn: HTMLElement | null | undefined): number {
  return drawn == null ? 0 : drawn.scrollHeight + (drawn.offsetHeight - drawn.clientHeight);
}
