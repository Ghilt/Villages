import type { ServerFrame, StandLayer } from '@villages/protocol';

import type { SocketLike } from './connection';
import type { Schedule } from './follower';
import type { SessionState } from './slices';

// What the session is handed from wherever it runs: who listens to it, what it needs, and how it connects. Its own
// file beside session.ts, which keeps the conversation itself.

/**
 * What listens to the conversation without taking part in it: a log. It is told when the session connects and
 * when the connection closes, and of a problem with a frame; and of every frame once the state has taken it in,
 * with the state as it was before, but before whatever the frame makes the session do, and again once that is
 * done. A command's answer comes with the part of the log its asking was filed in.
 */
export interface SessionListener {
  connecting?(address: string): void;
  closed?(): void;
  problem?(problem: string): void;
  heard?(frame: ServerFrame, was: SessionState, now: SessionState, answeredIn: string | null): void;
  done?(frame: ServerFrame): void;
}

/** What the session needs from wherever it runs. */
export interface SessionPorts {
  schedule: Schedule;
  /** A fresh UUID, for a command's id. See decision record 0035. */
  newId(): string;
  /** A layer of the stands for a tile, as far as the fog lets them through, and which cells are followed. See 0067. */
  standsArrived(x: number, y: number, stands: string, layer: StandLayer): void;
  followStands(cells: string[]): void;
  /** Arrives anew, for a world that has been emptied: a reload, in a browser. See decision record 0036. */
  arriveAnew(): void;
  /** What the follower and the commands say, as `note(area, message)`. */
  note(area: string, message: string): void;
}

export interface ConnectOptions {
  /** A socket whose handshake carries the browser's sign-in, which is who it plays as. See decision record 0111. */
  socket: SocketLike;
  protocolVersion: number;
  /** The master the page draws, said in hello so the gateway sends that world's stands. See 0067. */
  master?: string;
  /** Where it connects, for saying so. */
  address: string;
}
