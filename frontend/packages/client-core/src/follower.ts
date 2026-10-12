import type { ClientFrame } from '@villages/protocol';

import { whatToFollow } from './following';
import { cellsHeld, forgetCells, holdCells } from './onTheMap';
import type { OnTheMapState } from './onTheMap';

/**
 * How long what is on the screen is kept after the gateway has been told to stop sending it.
 *
 * Only reached when a snapshot never comes. The cells are normally let go the moment the ones that
 * replace them have answered, which is a round trip rather than this.
 */
export const HOLD_MS = 2000;

/** A clock to wait on, handed in so that a test can be the clock: runs `run` after `ms`, unless cancelled first. */
export interface Schedule {
  after(ms: number, run: () => void): () => void;
}

/** What the follower needs from the session it follows for. */
export interface FollowerPorts {
  /** Sends a frame, when the gateway is listening; see [canSend]. */
  send(frame: ClientFrame): void;
  /** Whether the gateway is listening: open, and past the welcome. */
  canSend(): boolean;
  /** What stands in the held cells now, which is the session's, and its replacement. */
  onTheMap(): OnTheMapState;
  setOnTheMap(onTheMap: OnTheMapState): void;
  /** Tells the scenery which cells the gateway is following now. See decision record 0067. */
  followStands(cells: string[]): void;
  /** Says something in the log, as `note(area, message)`. */
  note(area: string, message: string): void;
  schedule: Schedule;
}

export interface Follower {
  /**
   * Follows the camera: the cells covering the view, at the view's own zoom, are what the map draws. Safe to
   * call before the gateway has answered hello; the request waits for the welcome.
   */
  follow(cells: string[]): void;
  /** The gateway is listening now: what the camera wanted before it was is asked for. */
  welcomed(): void;
  /** A cell's snapshot has arrived, which may be the last thing a release was waiting for. */
  answered(cell: string): void;
  /** The last subscription was refused whole: put the connection back the way it was. */
  refused(why: string): void;
  /** Forgets that anything was being held late. For a connection that is starting or ending. */
  forget(): void;
}

/**
 * Following the camera's cells, and letting go late.
 *
 * Cell ids carry their zoom, so a step from one zoom to the next wants a different cell for the same
 * ground. Letting the old one go before the new one has answered empties the map for a round trip:
 * every house vanishes and every sprite with it. So what is held is let go late, and until then the
 * cells let go are held but no longer followed - drawn, and not asked about.
 */
export function follower(ports: FollowerPorts): Follower {
  /** What the camera last asked for, so it can be asked for again once the gateway is listening. */
  let wanted: string[] = [];
  /** Cells the gateway has been told to stop sending, whose marks are still drawn. */
  let released = new Set<string>();
  /** The cells of the last subscription, so that a refusal knows which ones are not coming. */
  let askedFor: string[] = [];
  /** The cells whose snapshots the release is waiting for. Empty means nothing is waiting. */
  let awaiting = new Set<string>();
  let holding: (() => void) | null = null;

  const stopHolding = () => {
    if (holding !== null) {
      holding();
      holding = null;
    }
  };

  /** Lets go of everything the gateway has stopped sending, and stops waiting for anything. */
  const letGoNow = (why: string) => {
    stopHolding();
    awaiting = new Set();
    if (released.size === 0) {
      return;
    }
    const cells = [...released];
    released = new Set();
    ports.note('cells', `let go of ${cells.length} cell${cells.length === 1 ? '' : 's'} ${why}`);
    ports.setOnTheMap(forgetCells(ports.onTheMap(), cells));
  };

  /**
   * Tells the scenery's stands which cells the gateway is following now, so that a tile it has let go of is let go
   * here too and coming back waits for it to be sent again. The cells held late are not followed: the gateway was
   * told to stop sending them. See decision record 0067.
   */
  const followStands = () => {
    ports.followStands(cellsHeld(ports.onTheMap()).filter((cell) => !released.has(cell)));
  };

  /**
   * Asks for the cells not yet followed, and lets go of the ones no longer wanted - but lets go late.
   *
   * The asking goes first and the forgetting waits. A zoom step wants a different cell for the same
   * ground, so letting the old one go first empties the map until the new one answers: every house is
   * dropped, every sprite is destroyed, and they come back a round trip later. That blink was the whole
   * of it. Now what is on the screen stays on the screen until what replaces it has arrived.
   *
   * The gateway is told to stop sending at once, because there is no reason for it to keep paying for
   * cells nobody is looking at. It is only this end that waits.
   */
  const sendFollowing = (cells: string[]) => {
    if (!ports.canSend()) {
      return;
    }
    // What is actually being followed. A released cell is still held - what is in it is still drawn - but
    // the gateway has stopped answering for it, so wanting it again means asking for it again.
    const followed = cellsHeld(ports.onTheMap()).filter((cell) => !released.has(cell));
    const { ask, letGo } = whatToFollow(followed, cells);

    // The gateway is told to stop sending **before** it is asked for more, because it holds at most
    // sixty-four cells and refuses a subscription that would take it past that - whole, not in part.
    // Asking first made it hold the old view and the new one at once, which at a wide zoom is ninety
    // cells for a view of forty-five, and every pan out there was refused. Only the *forgetting* was
    // ever meant to wait; the order on the wire is the one it always was.
    if (letGo.length > 0) {
      ports.send({ type: 'unsubscribeCells', cells: letGo });
      for (const cell of letGo) {
        released.add(cell);
      }
    }

    if (ask.length > 0) {
      for (const cell of ask) {
        released.delete(cell);
      }
      askedFor = ask;
      ports.setOnTheMap(holdCells(ports.onTheMap(), ask));
      ports.send({ type: 'subscribeCells', cells: ask });
    }
    if (letGo.length > 0 || ask.length > 0) {
      followStands();
    }

    if (released.size === 0) {
      return;
    }
    if (ask.length > 0) {
      // Wait for what was just asked for. A later call replaces this rather than adding to it: both
      // batches are in flight at once, so the later one answers at about the same moment, and the
      // timer is underneath either way.
      awaiting = new Set(ask);
      stopHolding();
      holding = ports.schedule.after(HOLD_MS, () =>
        letGoNow('after waiting for what should have replaced them'),
      );
    } else if (awaiting.size === 0) {
      // Nothing outstanding and nothing new asked for, so nothing is coming to replace them: a pan off
      // the edge of the world, or a view that shrank. Waiting would leave stale marks drawn.
      //
      // The `awaiting` test is what makes this safe to call twice. A map movement fires `moveend` and
      // `zoomend` both, so this runs twice for one step; the second time there is nothing left to ask
      // for, and without the test that second call would let go of everything a round trip early -
      // which is the very blink this exists to stop.
      letGoNow('with nothing asked for to replace them');
    }

    // Nothing is said about the asking. What the camera is following changes on every pan, and the answer
    // says the same thing better: the cells that came back, at what depth, and what was in them.
  };

  return {
    follow: (cells) => {
      wanted = cells;
      sendFollowing(cells);
    },

    welcomed: () => sendFollowing(wanted),

    // What replaces the released cells has arrived, so they can go now rather than on the timer.
    answered: (cell) => {
      if (awaiting.delete(cell) && awaiting.size === 0) {
        letGoNow('now that what replaces them has arrived');
      }
    },

    /**
     * Puts back what a refused subscription undid.
     *
     * The gateway refuses a subscription whole, so not one of the cells asked for is coming. Held and never
     * sent, they would be held for ever: `whatToFollow` compares against what is held, so it would never
     * ask for them again and the map could not recover by being moved back. So they are forgotten.
     *
     * And what was let go to make room for them is asked for again, because the gateway was told to stop
     * sending it a moment ago and the thing meant to replace it never arrived. Without that the map keeps
     * drawing marks nobody is updating until the release timer empties it.
     */
    refused: (why) => {
      stopHolding();
      awaiting = new Set();

      const refused = askedFor;
      askedFor = [];
      const back = [...released];
      released = new Set();

      if (refused.length > 0) {
        ports.setOnTheMap(forgetCells(ports.onTheMap(), refused));
      }
      followStands();
      ports.note(
        'cells',
        `${why}: forgot ${refused.length} that never came, asking again for ${back.length}`,
      );
      if (back.length > 0 && ports.canSend()) {
        ports.send({ type: 'subscribeCells', cells: back });
      }
    },

    forget: () => {
      stopHolding();
      released = new Set();
      awaiting = new Set();
    },
  };
}
