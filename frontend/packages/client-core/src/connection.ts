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
  playerToken: string;
  protocolVersion: number;
  /** Whether to ask for every stored event, which the debug panel wants and a player does not. */
  watchEvents?: boolean;
}

export interface Connection {
  state(): ConnectionState;
  /** Every frame the gateway sends, decoded and checked. A frame that fails the schema is reported, not thrown. */
  onFrame(handler: (frame: ServerFrame) => void): () => void;
  onProblem(handler: (problem: string) => void): () => void;
  send(frame: ClientFrame): void;
  close(): void;
}

/**
 * Opens the conversation: hello on open, then optionally watchEvents, then whatever the interface sends.
 * Nothing about reconnecting yet; that is increment 1.9 proper.
 */
export function connect(options: ConnectionOptions): Connection {
  const { socket } = options;
  let state: ConnectionState = 'connecting';
  const frameHandlers = new Set<(frame: ServerFrame) => void>();
  const problemHandlers = new Set<(problem: string) => void>();

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
    send({ type: 'hello', playerToken: options.playerToken, protocolVersion: options.protocolVersion });
    if (options.watchEvents === true) send({ type: 'watchEvents', on: true });
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
    send,
    close: () => socket.close(),
  };
}
