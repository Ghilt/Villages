import { connect, ensurePlayerToken } from '@villages/client-core';
import type { Connection } from '@villages/client-core';
import { PROTOCOL_VERSION } from '@villages/protocol';
import type { EventFrame, ServerFrame } from '@villages/protocol';

import { note } from '../debug/log';
import { browserSocket } from './browserSocket';

/**
 * The one connection to the gateway, and what it has heard. Frames go to the debug log as they happen;
 * events are kept so the panel can list them and open any one. See decision records 0023 and 0024.
 */

const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? 'ws://localhost:8080/ws';
const MOST_EVENTS = 300;

export interface GatewayState {
  connection: 'connecting' | 'open' | 'closed';
  playerId?: string;
  events: readonly EventFrame[];
  playerToken: string;
}

let state: GatewayState = { connection: 'connecting', events: [], playerToken: '' };
const listeners = new Set<() => void>();
let connection: Connection | null = null;

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
      return;
    case 'event':
      update({ events: [...state.events.slice(-(MOST_EVENTS - 1)), frame] });
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
    default:
      note('gateway', `${frame.type} frame`);
  }
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
    update({ connection: 'closed' });
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
