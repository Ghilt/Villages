import { connect, ensurePlayerToken, forgetPlayerToken } from '@villages/client-core';
import type { Connection, HousesState } from '@villages/client-core';
import {
  NO_HOUSES,
  cellsHeld,
  forgetCells,
  holdCells,
  reduceHouses,
  whatToFollow,
} from '@villages/client-core';
import { PROTOCOL_VERSION, describeDay } from '@villages/protocol';
import type {
  ChoiceView,
  CommandPayload,
  OptionView,
  ResourceName,
  ServerFrame,
  YourHouseView,
} from '@villages/protocol';

import { note, shortId } from '../debug/log';
import { NOTHING_ARRIVED, alsoArrived, describeArrival } from './arrivals';
import type { Arrival } from './arrivals';
import { browserSocket } from './browserSocket';

/**
 * The one connection to the gateway, and what it has heard: the events, for the debug panel, and the
 * houses in the cells being followed, for the map. Frames go to the debug log as they happen. See
 * decision records 0023, 0024 and 0026.
 */

export const GATEWAY_URL =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ??
  `ws://localhost:${(import.meta.env.VITE_GAME_PORT as string | undefined) ?? '8080'}/ws`;

export interface GatewayState {
  connection: 'connecting' | 'open' | 'closed' | 'takenOver';
  playerId?: string;
  /** The player's own house and what only they can see of it, or null when they have none. */
  yourHouse: YourHouseView | null;
  /** What this player has to decide, or null when they have nothing. What the parchment shows. */
  yourChoice: ChoiceView | null;
  /** The id of the command in flight, so the parchment can stop taking a second answer. */
  acting: string | null;
  houses: HousesState;
  /** Where the world's clock stands, as welcome said, or null until it has. */
  world: { today: number; earliest: number } | null;
  playerToken: string;
}

let state: GatewayState = {
  connection: 'connecting',
  yourHouse: null,
  yourChoice: null,
  acting: null,
  houses: NO_HOUSES,
  world: null,
  playerToken: '',
};
const listeners = new Set<() => void>();
let connection: Connection | null = null;
/** What the camera last asked for, so it can be asked for again once the gateway is listening. */
let wanted: string[] = [];
/** Whether the switch is on, so a reconnection sets significance aside again before asking for a cell. */
let everything = false;

/**
 * How long the snapshots of one burst are gathered before they are said in a line.
 *
 * The same quarter second the gateway coalesces its deltas over, and for the same reason: a view is a
 * few dozen cells and each answers separately, so what is worth reading is the burst and not the frame.
 */
const GATHER_MS = 250;
let arriving: Arrival = NOTHING_ARRIVED;
let gathering: ReturnType<typeof setTimeout> | null = null;

/**
 * How long what is on the screen is kept after the gateway has been told to stop sending it.
 *
 * Only reached when a snapshot never comes. The cells are normally let go the moment the ones that
 * replace them have answered, which is a round trip rather than this.
 */
const HOLD_MS = 2000;

/**
 * Cells the gateway has been told to stop sending, whose houses are still drawn.
 *
 * Cell ids carry their zoom, so a step from one zoom to the next wants a different cell for the same
 * ground. Letting the old one go before the new one has answered empties the map for a round trip:
 * every house vanishes and every sprite with it. So what is held is let go late, and until then these
 * cells are held but no longer followed - drawn, and not asked about.
 */
let released = new Set<string>();
/** The cells of the last subscription, so that a refusal knows which ones are not coming. */
let askedFor: string[] = [];
/** The cells whose snapshots the release is waiting for. Empty means nothing is waiting. */
let awaiting = new Set<string>();
let holding: ReturnType<typeof setTimeout> | null = null;

/** Lets go of everything the gateway has stopped sending, and stops waiting for anything. */
function letGoNow(why: string): void {
  if (holding !== null) {
    clearTimeout(holding);
    holding = null;
  }
  awaiting = new Set();
  if (released.size === 0) {
    return;
  }
  const cells = [...released];
  released = new Set();
  note('cells', `let go of ${cells.length} cell${cells.length === 1 ? '' : 's'} ${why}`);
  update({ houses: forgetCells(state.houses, cells) });
}

/**
 * Puts back what a refused subscription undid.
 *
 * The gateway refuses a subscription whole, so not one of the cells asked for is coming. Held and never
 * sent, they would be held for ever: `whatToFollow` compares against what is held, so it would never
 * ask for them again and the map could not recover by being moved back. So they are forgotten.
 *
 * And what was let go to make room for them is asked for again, because the gateway was told to stop
 * sending it a moment ago and the thing meant to replace it never arrived. Without that the map keeps
 * drawing houses nobody is updating until the release timer empties it.
 */
function askAgainAfterARefusal(why: string): void {
  if (holding !== null) {
    clearTimeout(holding);
    holding = null;
  }
  awaiting = new Set();

  const refused = askedFor;
  askedFor = [];
  const back = [...released];
  released = new Set();

  if (refused.length > 0) {
    update({ houses: forgetCells(state.houses, refused) });
  }
  note('cells', `${why}: forgot ${refused.length} that never came, asking again for ${back.length}`);
  if (back.length > 0 && connection !== null && state.connection === 'open') {
    connection.send({ type: 'subscribeCells', cells: back });
  }
}

/** Forgets that anything was being held late. For a connection that is starting or ending. */
function forgetTheHold(): void {
  if (holding !== null) {
    clearTimeout(holding);
    holding = null;
  }
  released = new Set();
  awaiting = new Set();
}

function update(change: Partial<GatewayState>): void {
  state = { ...state, ...change };
  for (const listener of listeners) listener();
}

function heard(frame: ServerFrame): void {
  switch (frame.type) {
    case 'welcome':
      update({ connection: 'open', playerId: frame.playerId, world: frame.world });
      note(
        'gateway',
        `welcome: player ${frame.playerId.slice(0, 8)}, server time ${new Date(frame.serverTime).toISOString()}`,
      );
      note(
        'world',
        `today is ${describeDay(frame.world.today)}; the earliest thing is from ${describeDay(frame.world.earliest)}`,
      );
      // The eye first, because it decides what a snapshot carries and the cells are asked for next.
      sendEye();
      // Anything the camera wanted before the gateway was listening is asked for now.
      sendFollowing(wanted);
      return;
    case 'snapshot':
      update({ houses: reduceHouses(state.houses, frame) });
      // What replaces the released cells has arrived, so they can go now rather than on the timer.
      if (awaiting.delete(frame.cell) && awaiting.size === 0) {
        letGoNow('now that what replaces them has arrived');
      }
      gather(frame);
      return;
    case 'batch':
      update({ houses: reduceHouses(state.houses, frame) });
      note('cells', `${frame.deltas.length} delta${frame.deltas.length === 1 ? '' : 's'} in one batch`);
      return;
    case 'resync':
      update({ houses: reduceHouses(state.houses, frame) });
      note('cells', `fell behind; asking again for ${frame.cells.length} cells`);
      // The gateway let these go. Asking again is what gets fresh snapshots.
      connection?.send({ type: 'subscribeCells', cells: frame.cells });
      return;
    case 'commandAccepted':
      if (state.acting === frame.commandId) update({ acting: null });
      note('gateway', `command ${shortId(frame.commandId)} accepted`);
      return;
    case 'commandRejected':
      if (state.acting === frame.commandId) update({ acting: null });
      note('gateway', `command ${shortId(frame.commandId)} rejected: ${frame.reason}`);
      return;
    case 'error':
      note('gateway', `error ${frame.code}: ${frame.message}`);
      if (frame.code === 'tooManyCells' || frame.code === 'badCell') {
        // The whole subscription was refused. Put the connection back the way it was, or the map goes
        // blank and stays blank however far it is panned. See the note on `askAgainAfterARefusal`.
        askAgainAfterARefusal(`the gateway refused ${frame.code}`);
      }
      if (frame.code === 'protocolVersion') {
        // The one error whose cause is never in the code: a server left running from an older build.
        // Saying what to do here saves reading the message and guessing. See decision record 0037.
        note(
          'gateway',
          `this page speaks version ${PROTOCOL_VERSION}, so the server on the other end is a different ` +
            'build of the program. Stop it and start it again from this tree with debug-quick-start.ps1 -Stop.',
        );
      }
      return;
    case 'pong':
      note('gateway', `pong, round trip ${Date.now() - frame.t0} ms`);
      return;
    case 'yourHouse':
      update({ yourHouse: frame.yours });
      note('house', frame.yours === null ? 'no house yet' : `your house is ${frame.yours.house.name}`);
      return;
    case 'yourChoice':
      update({ yourChoice: frame.choice });
      note(
        'choice',
        frame.choice === null
          ? 'nothing to decide'
          : `"${frame.choice.prompt}", ${frame.choice.options.length} options`,
      );
      return;
    case 'worldWiped':
      // The world this window was looking at is gone. Arriving anew is the only honest thing to do, and
      // a reload is how a page arrives. See decision record 0036.
      note('world', `${frame.message}; arriving anew`);
      window.location.reload();
      return;
    case 'takenOver':
      // A player plays from one place. This window is finished; the socket goes with it. See 0028.
      forgetTheHold();
      update({ connection: 'takenOver', houses: NO_HOUSES, yourHouse: null, yourChoice: null });
      note('gateway', `${frame.message}; this window is no longer playing`);
      connection?.close();
      return;
  }
}

/**
 * Counts one snapshot into the burst, and says what the burst brought once it stops arriving.
 *
 * A burst that brought nothing is not said at all: panning over empty world is not news, and a line a
 * cell buried everything else in the panel once the panel was the log. See decision record 0023.
 */
function gather(frame: Extract<ServerFrame, { type: 'snapshot' }>): void {
  arriving = alsoArrived(arriving, frame);
  if (gathering !== null) {
    clearTimeout(gathering);
  }
  gathering = setTimeout(() => {
    gathering = null;
    const said = describeArrival(arriving);
    arriving = NOTHING_ARRIVED;
    if (said !== null) {
      note('cells', said);
    }
  }, GATHER_MS);
}

function sendEye(): void {
  if (connection === null || state.connection !== 'open' || !everything) {
    return;
  }
  connection.send({ type: 'seeAll', on: true });
}

/**
 * Opens or closes the eye on this connection: with it open the gateway sets significance aside and every
 * house in a held cell is sent, however far back the camera is. Safe before the gateway has answered
 * hello; the welcome opens it. See decision record 0038.
 */
export function seeAll(on: boolean): void {
  everything = on;
  if (connection === null || state.connection !== 'open') {
    return;
  }
  connection.send({ type: 'seeAll', on });
}

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
function sendFollowing(cells: string[]): void {
  if (connection === null || state.connection !== 'open') {
    return;
  }
  // What is actually being followed. A released cell is still held - its houses are still drawn - but
  // the gateway has stopped answering for it, so wanting it again means asking for it again.
  const followed = cellsHeld(state.houses).filter((cell) => !released.has(cell));
  const { ask, letGo } = whatToFollow(followed, cells);

  // The gateway is told to stop sending **before** it is asked for more, because it holds at most
  // sixty-four cells and refuses a subscription that would take it past that - whole, not in part.
  // Asking first made it hold the old view and the new one at once, which at a wide zoom is ninety
  // cells for a view of forty-five, and every pan out there was refused. Only the *forgetting* was
  // ever meant to wait; the order on the wire is the one it always was.
  if (letGo.length > 0) {
    connection.send({ type: 'unsubscribeCells', cells: letGo });
    for (const cell of letGo) {
      released.add(cell);
    }
  }

  if (ask.length > 0) {
    for (const cell of ask) {
      released.delete(cell);
    }
    askedFor = ask;
    update({ houses: holdCells(state.houses, ask) });
    connection.send({ type: 'subscribeCells', cells: ask });
  }

  if (released.size === 0) {
    return;
  }
  if (ask.length > 0) {
    // Wait for what was just asked for. A later call replaces this rather than adding to it: both
    // batches are in flight at once, so the later one answers at about the same moment, and the
    // timer is underneath either way.
    awaiting = new Set(ask);
    if (holding !== null) {
      clearTimeout(holding);
    }
    holding = setTimeout(() => letGoNow('after waiting for what should have replaced them'), HOLD_MS);
  } else if (awaiting.size === 0) {
    // Nothing outstanding and nothing new asked for, so nothing is coming to replace them: a pan off
    // the edge of the world, or a view that shrank. Waiting would leave stale houses drawn.
    //
    // The `awaiting` test is what makes this safe to call twice. A map movement fires `moveend` and
    // `zoomend` both, so this runs twice for one step; the second time there is nothing left to ask
    // for, and without the test that second call would let go of everything a round trip early -
    // which is the very blink this exists to stop.
    letGoNow('with nothing asked for to replace them');
  }

  // Nothing is said about the asking. What the camera is following changes on every pan, and the answer
  // says the same thing better: the cells that came back, at what depth, and what was in them.
}

/**
 * Follows the camera: the cells covering the view, at the view's own zoom, are what the map draws. Safe to
 * call before the gateway has answered hello; the request waits for the welcome.
 */
export function follow(cells: string[]): void {
  wanted = cells;
  sendFollowing(cells);
}

/** Connects once, the first time anything asks. */
export function gateway(): Connection {
  if (connection !== null) return connection;

  const playerToken = ensurePlayerToken(
    { get: (key) => localStorage.getItem(key), set: (key, value) => localStorage.setItem(key, value) },
    () => crypto.randomUUID(),
  );
  update({ playerToken });
  note('gateway', `connecting to ${GATEWAY_URL}`);

  const socket = browserSocket(GATEWAY_URL);
  socket.onClose(() => {
    // A window that was taken over closed its own socket on purpose. Saying "the connection closed, is
    // the backend running?" over the top of that would be the panel telling a plain lie; see 0023.
    if (state.connection === 'takenOver') {
      return;
    }
    forgetTheHold();
    update({ connection: 'closed', houses: NO_HOUSES });
    note('gateway', 'the connection closed; is the backend running? cd backend then ./gradlew :app:bootRun');
  });
  // Not watching events: those are read on their own page, which watches without playing. See 0023.
  connection = connect({ socket, playerToken, protocolVersion: PROTOCOL_VERSION });
  connection.onFrame(heard);
  connection.onProblem((problem) => note('gateway', problem));
  return connection;
}

/** Empties the development world, for everyone connected to it. A debug affordance; see 0036. */
export function wipeWorld(): void {
  if (connection === null || state.connection !== 'open') {
    return;
  }
  note('world', 'emptying the world');
  connection.send({ type: 'wipeWorld' });
}

/**
 * Takes one option of the choice this player has, and says so in the log.
 *
 * Which story this continues is not sent: the server reads it from the choice, because a client cannot
 * name a story that is not its own. See decision record 0035.
 */
export function takeOption(choice: ChoiceView, option: OptionView): void {
  if (connection === null || state.connection !== 'open' || state.acting !== null) {
    return;
  }
  const commandId = crypto.randomUUID();
  update({ acting: commandId });
  note('command', `taking "${option.label}" as ${shortId(commandId)}`);
  connection.send({
    type: 'command',
    commandId,
    command: { type: 'takeAction', choiceId: choice.id, optionId: option.id },
  });
}

/**
 * Doing something to what your house has.
 *
 * All four send a real command and are told the answer the same way anything else is: an accepted or a
 * rejected frame, and then the house coming back changed. Nothing is assumed here - the number on the
 * card moves when the world says it did.
 *
 * Granting and spending are **Adam's levers** for now rather than a player's: nothing in the game gives a
 * house anything yet. They are here so that what the domain can do can be made to happen and watched.
 */
function act(what: string, command: CommandPayload): void {
  if (connection === null || state.connection !== 'open') {
    return;
  }
  const commandId = crypto.randomUUID();
  note('resources', `${what} as ${shortId(commandId)}`);
  connection.send({ type: 'command', commandId, command });
}

export function grantResource(resource: ResourceName, amount: number): void {
  act(`granting ${amount} ${resource}`, { type: 'grantResource', resource, amount });
}

export function spendResource(resource: ResourceName, amount: number): void {
  act(`spending ${amount} ${resource}`, { type: 'spendResource', resource, amount });
}

export function pledgeResource(
  resource: ResourceName,
  amount: number,
  months: number,
  purpose: string,
): void {
  act(`pledging ${amount} ${resource} for ${months} ${months === 1 ? 'month' : 'months'}`, {
    type: 'pledgeResource',
    resource,
    amount,
    months,
    purpose,
  });
}

export function releasePledge(pledgeId: string): void {
  act(`releasing pledge ${shortId(pledgeId)}`, { type: 'releasePledge', pledgeId });
}

/**
 * Starts over as a new player: forgets who this browser was and reloads.
 *
 * The house the old player founded stays in the world as somebody's, because events are never deleted.
 * A reload rather than a fresh socket, because a page carries the old player in more places than the
 * connection: the houses it holds, the day it is looking at, what it thinks its house is. See 0036.
 */
export function restart(): void {
  forgetPlayerToken({
    get: (key) => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
  });
  note('player', 'starting over as somebody new');
  window.location.reload();
}

export function gatewayState(): GatewayState {
  return state;
}

export function watchGateway(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
