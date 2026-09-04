import type { SocketLike } from '@villages/client-core';

/** The browser's WebSocket behind the interface the client core asks for. The only place `WebSocket` appears. */
export function browserSocket(url: string): SocketLike {
  const socket = new WebSocket(url);
  return {
    send: (text) => socket.send(text),
    close: () => socket.close(),
    onOpen: (handler) => socket.addEventListener('open', handler),
    onMessage: (handler) => socket.addEventListener('message', (event) => handler(String(event.data))),
    onClose: (handler) => socket.addEventListener('close', handler),
  };
}
