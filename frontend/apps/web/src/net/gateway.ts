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
import type { ChoiceView, EventFrame, HouseView, OptionView, ServerFrame } from '@villages/protocol';

import { note, shortId } from '../debug/log';
import { browserSocket } from './browserSocket';

/**
 * The one connection to the gateway, and what it has heard: the events, for the debug panel, and the
 * houses in the cells being followed, for the map. Frames go to the debug log as they happen. See
 * decision records 0023, 0024 and 0026.
 */

export const GATEWAY_URL =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? 'ws://localhost:8080/ws';
const MOST_EVENTS = 300;

export interface GatewayState {
  connection: 'connecting' | 'open' | 'closed' | 'takenOver';
  playerId?: string;
  /** The player's own house, wherever they are looking, or null when they have none. */
  yourHouse: HouseView | null;
  /** What this player has to decide, or null when they have nothing. What the parchment shows. */
  yourChoice: ChoiceView | null;
  /** The id of the command in flight, so the parchment can stop taking a second answer. */
  acting: string | null;
  events: readonly EventFrame[];
  houses: HousesState;
  /** Where the world's clock stands, as welcome said, or null until it has. */
  world: { today: number; earliest: number } | null;
  /** The world-day being looked at, or null for live. The timeline scrubber's position. */
  viewingAt: number | null;
  playerToken: string;
}

let state: GatewayState = {
  connection: 'connecting',
  events: [],
  yourHouse: null,
  yourChoice: null,
  acting: null,
  houses: NO_HOUSES,
  world: null,
  viewingAt: null,
  playerToken: '',
};
const listeners = new Set<() => void>();
let connection: Connection | null = null;
/** What the camera last asked for, so it can be asked for again once the gateway is listening. */
let wanted: string[] = [];

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
      // Anything the camera wanted before the gateway was listening is asked for now.
      sendFollowing(wanted);
      return;
    case 'event':
      update({ events: [...state.events.slice(-(MOST_EVENTS - 1)), frame] });
      return;
    case 'snapshot':
      update({ houses: reduceHouses(state.houses, frame) });
      note(
        'cells',
        `${frame.cell || 'the world'}: ${frame.houses.length} house${frame.houses.length === 1 ? '' : 's'}` +
          ((frame.omitted ?? 0) > 0 ? ` and ${frame.omitted} more not sent` : ''),
      );
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
      return;
    case 'pong':
      note('gateway', `pong, round trip ${Date.now() - frame.t0} ms`);
      return;
    case 'yourHouse':
      update({ yourHouse: frame.house });
      note('house', frame.house === null ? 'no house yet' : `your house is ${frame.house.name}`);
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
    case 'takenOver':
      // A player plays from one place. This window is finished; the socket goes with it. See 0028.
      update({ connection: 'takenOver', houses: NO_HOUSES, yourHouse: null, yourChoice: null });
      note('gateway', `${frame.message}; this window is no longer playing`);
      connection?.close();
      return;
  }
}

/** Asks for the cells not yet held and lets go of the ones no longer wanted, and says so in the log. */
function sendFollowing(cells: string[]): void {
  if (connection === null || state.connection !== 'open') {
    return;
  }
  const { ask, letGo } = whatToFollow(cellsHeld(state.houses), cells);
  if (letGo.length > 0) {
    connection.send({ type: 'unsubscribeCells', cells: letGo });
    update({ houses: forgetCells(state.houses, letGo) });
  }
  if (ask.length > 0) {
    update({ houses: holdCells(state.houses, ask) });
    connection.send({ type: 'subscribeCells', cells: ask });
  }
  if (ask.length + letGo.length > 0) {
    note('cells', `following ${cells.length} at z${cells[0]?.length ?? 0}: +${ask.length} -${letGo.length}`);
  }
}

/** Looks at the world as of a day, or at live when null. Every held cell comes back as of that day. */
export function viewAt(day: number | null): void {
  if (connection === null || state.connection !== 'open') {
    return;
  }
  update({ viewingAt: day });
  connection.send({ type: 'viewTime', at: day });
  note('world', day === null ? 'looking at live' : `looking at ${describeDay(day)}`);
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
    update({ connection: 'closed', houses: NO_HOUSES });
    note('gateway', 'the connection closed; is the backend running? cd backend then ./gradlew :app:bootRun');
  });
  connection = connect({ socket, playerToken, protocolVersion: PROTOCOL_VERSION, watchEvents: true });
  connection.onFrame(heard);
  connection.onProblem((problem) => note('gateway', problem));
  return connection;
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
