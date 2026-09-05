import { connect, ensurePlayerToken } from '@villages/client-core';
import type { Connection, HousesState } from '@villages/client-core';
import {
  NO_HOUSES,
  cellsHeld,
  forgetCells,
  holdCells,
  reduceHouses,
  whatToFollow,
} from '@villages/client-core';
import { PROTOCOL_VERSION } from '@villages/protocol';
import type { EventFrame, ServerFrame } from '@villages/protocol';

import { note } from '../debug/log';
import { browserSocket } from './browserSocket';

/**
 * The one connection to the gateway, and what it has heard: the events, for the debug panel, and the
 * houses in the cells being followed, for the map. Frames go to the debug log as they happen. See
 * decision records 0023, 0024 and 0026.
 */

const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? 'ws://localhost:8080/ws';
const MOST_EVENTS = 300;

export interface GatewayState {
  connection: 'connecting' | 'open' | 'closed';
  playerId?: string;
  events: readonly EventFrame[];
  houses: HousesState;
  playerToken: string;
}

let state: GatewayState = { connection: 'connecting', events: [], houses: NO_HOUSES, playerToken: '' };
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
      update({ connection: 'open', playerId: frame.playerId });
      note(
        'gateway',
        `welcome: player ${frame.playerId.slice(0, 8)}, server time ${new Date(frame.serverTime).toISOString()}`,
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
      note('gateway', `command ${frame.commandId} accepted`);
      return;
    case 'commandRejected':
      note('gateway', `command ${frame.commandId} rejected: ${frame.reason}`);
      return;
    case 'error':
      note('gateway', `error ${frame.code}: ${frame.message}`);
      return;
    case 'pong':
      note('gateway', `pong, round trip ${Date.now() - frame.t0} ms`);
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
    update({ connection: 'closed', houses: NO_HOUSES });
    note('gateway', 'the connection closed; is the backend running? cd backend then ./gradlew :app:bootRun');
  });
  connection = connect({ socket, playerToken, protocolVersion: PROTOCOL_VERSION, watchEvents: true });
  connection.onFrame(heard);
  connection.onProblem((problem) => note('gateway', problem));
  return connection;
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
