import { describe, expect, it } from 'vitest';

import type { ServerFrame } from '@villages/protocol';

import { connect } from './connection';
import type { SocketLike } from './connection';

/** A socket that records what was sent and lets the test play the gateway. */
function fakeSocket() {
  const sent: unknown[] = [];
  let open: () => void = () => undefined;
  let message: (text: string) => void = () => undefined;
  let close: () => void = () => undefined;
  const socket: SocketLike = {
    send: (text) => sent.push(JSON.parse(text)),
    close: () => close(),
    onOpen: (handler) => (open = handler),
    onMessage: (handler) => (message = handler),
    onClose: (handler) => (close = handler),
  };
  return {
    socket,
    sent,
    gatewayOpens: () => open(),
    gatewaySays: (frame: unknown) => message(JSON.stringify(frame)),
  };
}

const token = '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b';

describe('the connection', () => {
  it('introduces itself as soon as the socket opens, and asks to watch events when told to', () => {
    const fake = fakeSocket();
    connect({ socket: fake.socket, playerToken: token, protocolVersion: 1, watchEvents: true });

    expect(fake.sent).toEqual([]);
    fake.gatewayOpens();
    expect(fake.sent).toEqual([
      { type: 'hello', playerToken: token, protocolVersion: 1 },
      { type: 'watchEvents', on: true },
    ]);
  });

  it('says in hello which master the page draws, when it draws one, so the gateway sends its stands', () => {
    const fake = fakeSocket();
    connect({ socket: fake.socket, playerToken: token, protocolVersion: 1, master: 'terrain2' });

    fake.gatewayOpens();
    expect(fake.sent).toEqual([
      { type: 'hello', playerToken: token, protocolVersion: 1, master: 'terrain2' },
    ]);
  });

  it('says nothing about a player when there is none, so a viewer takes nobody over', () => {
    const fake = fakeSocket();

    connect({ socket: fake.socket, protocolVersion: 1, watchEvents: true });
    fake.gatewayOpens();

    // No hello: the gateway knows of no player, so nothing is founded and no session is stood down.
    expect(fake.sent).toEqual([{ type: 'watchEvents', on: true }]);
  });

  it('asks what the catalogues are for an inspect page, and nothing about a player', () => {
    const fake = fakeSocket();

    connect({ socket: fake.socket, protocolVersion: 1, watchCatalogues: true });
    fake.gatewayOpens();

    expect(fake.sent).toEqual([{ type: 'watchCatalogues', on: true }]);
  });

  it('hands decoded frames to whoever is listening', () => {
    const fake = fakeSocket();
    const heard: ServerFrame[] = [];
    connect({ socket: fake.socket, playerToken: token, protocolVersion: 1 }).onFrame((frame) =>
      heard.push(frame),
    );

    fake.gatewaySays({
      type: 'welcome',
      serverTime: 1788609600200,
      playerId: token,
      world: { today: 454901, earliest: 437635 },
    });

    expect(heard).toEqual([
      {
        type: 'welcome',
        serverTime: 1788609600200,
        playerId: token,
        world: { today: 454901, earliest: 437635 },
      },
    ]);
  });

  it('reports a frame the schema refuses rather than passing it on or throwing', () => {
    const fake = fakeSocket();
    const heard: ServerFrame[] = [];
    const problems: string[] = [];
    const connection = connect({ socket: fake.socket, playerToken: token, protocolVersion: 1 });
    connection.onFrame((frame) => heard.push(frame));
    connection.onProblem((problem) => problems.push(problem));

    fake.gatewaySays({ type: 'goodbye' });
    fake.gatewaySays('not even json');

    expect(heard).toEqual([]);
    expect(problems).toHaveLength(2);
  });

  it('refuses to send a frame that fails the schema', () => {
    const fake = fakeSocket();
    const problems: string[] = [];
    const connection = connect({ socket: fake.socket, playerToken: token, protocolVersion: 1 });
    connection.onProblem((problem) => problems.push(problem));

    connection.send({ type: 'subscribeCells', cells: ['not-a-cell'] });

    expect(fake.sent).toEqual([]);
    expect(problems).toHaveLength(1);
  });

  it('knows whether it is open', () => {
    const fake = fakeSocket();
    const connection = connect({ socket: fake.socket, playerToken: token, protocolVersion: 1 });

    expect(connection.state()).toBe('connecting');
    fake.gatewayOpens();
    expect(connection.state()).toBe('open');
    connection.close();
    expect(connection.state()).toBe('closed');
  });
});
