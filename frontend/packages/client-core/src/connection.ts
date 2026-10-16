import { clientFrameSchema, serverFrameSchema } from '@villages/protocol';
import type { ClientFrame, ServerFrame } from '@villages/protocol';

/**
 * The connection to the gateway, with the socket injected: this package has no DOM, so it cannot open a
 * WebSocket and never tries. Whatever the interface hands in only needs to send text and report text.
 */
export interface SocketLike {
  send(text: string): void;
  close(): void;
  onOpen(handler: () => void): void;
  onMessage(handler: (text: string) => void): void;
  onClose(handler: () => void): void;
}

export type ConnectionState = 'connecting' | 'open' | 'closed';

export interface ConnectionOptions {
  socket: SocketLike;
  /**
   * Who is playing, or absent for a connection that is not playing at all.
   *
   * Without a token no hello is sent, and the gateway therefore knows of no player: nothing is founded,
   * nothing is asked, and no session is taken over. That is what an event viewer is. A player plays from
   * one place (decision 0028), and a watcher is not in that place.
   */
  playerToken?: string;
  protocolVersion: number;
  /** The master the page draws, said in hello so the gateway sends that world's stands. See 0067. */
  master?: string;
  /** Whether to ask for every stored event, which a viewer wants and a player does not. */
  watchEvents?: boolean;
  /** Whether to ask what the game server's catalogues are, which an inspect page wants. See 0097. */
  watchCatalogues?: boolean;
}

export interface Connection {
  state(): ConnectionState;
  /** Every frame the gateway sends, decoded and checked. A frame that fails the schema is reported, not thrown. */
  onFrame(handler: (frame: ServerFrame) => void): () => void;
  onProblem(handler: (problem: string) => void): () => void;
  /** The connection has gone, from either end. */
  onClose(handler: () => void): () => void;
  send(frame: ClientFrame): void;
  close(): void;
}

/**
 * Opens the conversation: hello on open when there is a player to introduce, then optionally
 * watchEvents and watchCatalogues, then whatever the interface sends. Nothing about reconnecting yet; that is 1.9 proper.
 */
export function connect(options: ConnectionOptions): Connection {
  const { socket } = options;
  let state: ConnectionState = 'connecting';
  const frameHandlers = new Set<(frame: ServerFrame) => void>();
  const problemHandlers = new Set<(problem: string) => void>();
  const closeHandlers = new Set<() => void>();

  const problem = (text: string) => {
    for (const handler of problemHandlers) handler(text);
  };

  const send = (frame: ClientFrame) => {
    // Checked on the way out too, so a malformed frame is caught here rather than refused by the gateway.
    const checked = clientFrameSchema.safeParse(frame);
    if (!checked.success) {
      problem(`refusing to send a frame that fails the schema: ${checked.error.message}`);
      return;
    }
    socket.send(JSON.stringify(checked.data));
  };

  socket.onOpen(() => {
    state = 'open';
    const playing = options.playerToken;
    if (playing !== undefined) {
      const drawing = options.master === undefined ? {} : { master: options.master };
      send({ type: 'hello', playerToken: playing, protocolVersion: options.protocolVersion, ...drawing });
    }
    if (options.watchEvents === true) send({ type: 'watchEvents', on: true });
    if (options.watchCatalogues === true) send({ type: 'watchCatalogues', on: true });
  });

  socket.onMessage((text) => {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      problem(`the gateway sent something that is not JSON: ${text.slice(0, 80)}`);
      return;
    }
    const parsed = serverFrameSchema.safeParse(raw);
    if (!parsed.success) {
      problem(`the gateway sent a frame the schema refuses: ${parsed.error.message}`);
      return;
    }
    for (const handler of frameHandlers) handler(parsed.data);
  });

  socket.onClose(() => {
    state = 'closed';
    for (const handler of closeHandlers) handler();
  });

  return {
    state: () => state,
    onFrame: (handler) => {
      frameHandlers.add(handler);
      return () => frameHandlers.delete(handler);
    },
    onProblem: (handler) => {
      problemHandlers.add(handler);
      return () => problemHandlers.delete(handler);
    },
    onClose: (handler) => {
      closeHandlers.add(handler);
      return () => closeHandlers.delete(handler);
    },
    send,
    close: () => socket.close(),
  };
}
