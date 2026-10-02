import type { ClientFrame } from '@villages/protocol';

import type { SocketLike } from './connection';

/**
 * A socket a test plays the gateway through, for this package's tests and for anything built on it.
 *
 * It keeps every handler it is given, as a browser's WebSocket keeps every listener, because more than one part of
 * a client listens for the same thing: the connection and the page both hear the socket close. What the client
 * sends is kept, parsed, in the order it was sent.
 */
export interface FakeSocket {
  readonly socket: SocketLike;
  /** Every frame the client has sent, in order. */
  readonly sent: ClientFrame[];
  /** Whether the client has closed it. */
  closedByClient(): boolean;
  /** The gateway takes the connection. */
  opens(): void;
  /** The gateway sends something: a frame, or whatever a test wants to see refused. */
  says(frame: unknown): void;
  /** The connection goes, from the gateway's end or the network's. */
  closes(): void;
}

export function fakeSocket(): FakeSocket {
  const sent: ClientFrame[] = [];
  const opened: (() => void)[] = [];
  const heard: ((text: string) => void)[] = [];
  const closed: (() => void)[] = [];
  let byClient = false;

  const closes = () => {
    for (const handler of [...closed]) handler();
  };

  return {
    socket: {
      send: (text) => sent.push(JSON.parse(text) as ClientFrame),
      close: () => {
        byClient = true;
        closes();
      },
      onOpen: (handler) => opened.push(handler),
      onMessage: (handler) => heard.push(handler),
      onClose: (handler) => closed.push(handler),
    },
    sent,
    closedByClient: () => byClient,
    opens: () => {
      for (const handler of [...opened]) handler();
    },
    says: (frame) => {
      const text = JSON.stringify(frame);
      for (const handler of [...heard]) handler(text);
    },
    closes,
  };
}
