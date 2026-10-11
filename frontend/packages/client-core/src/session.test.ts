import { describe, expect, it } from 'vitest';

import type { ServerFrame } from '@villages/protocol';

import { NO_HOUSES, cellsHeld, holdCells } from './houses';
import { createSession } from './session';
import { INITIAL_SESSION, endState, foldFrame } from './slices';
import type { SessionState } from './slices';
import { fakeSocket } from './testing';

/*
 * The frames, as small as a fold needs them: a part keeps what it is sent, so what is in it is not the question.
 * The package is checked without Node or a browser, so the shared fixtures are read by the page's own test.
 */
const welcome: ServerFrame = {
  type: 'welcome',
  serverTime: 0,
  playerId: 'a1b2c3d4-0000-4000-8000-000000000001',
  world: { today: 454901, earliest: 437635 },
};
const HOUSE_FRAMES = [
  { type: 'yourHouse', yours: { house: { name: 'Ravenscar' } } },
  { type: 'yourChoice', choice: { prompt: 'Where shall the house raise its seat?' } },
  { type: 'yourKeyFigures', keyFigures: [{ id: 'agnes' }, { id: 'wilhelm' }] },
  { type: 'yourHoldings', holdings: [{ id: 'castle' }, { id: 'mill' }, { id: 'abbey' }] },
  { type: 'yourSight', points: [{}, {}, {}, {}], tension: 40 },
  { type: 'yourDialogues', dialogues: [{}, {}, {}, {}] },
] as unknown as ServerFrame[];

/** A session that has heard the house's every frame, holding a cell. */
function heardEverything(): SessionState {
  let state: SessionState = { ...INITIAL_SESSION, houses: holdCells(NO_HOUSES, ['12003122']) };
  for (const frame of [welcome, ...HOUSE_FRAMES]) {
    state = foldFrame(state, frame);
  }
  return state;
}

describe('the session, folded from what each mechanic folds', () => {
  it("takes each of the house's frames into its own part", () => {
    const state = heardEverything();

    expect(state.connection).toBe('open');
    expect(state.yourHouse?.house.name).toBe('Ravenscar');
    expect(state.yourChoice?.prompt).toBe('Where shall the house raise its seat?');
    expect(state.yourKeyFigures).toHaveLength(2);
    expect(state.yourHoldings).toHaveLength(3);
    expect(state.yourSight?.points).toHaveLength(4);
    expect(state.yourDialogues).toHaveLength(4);
  });

  it('closed, keeps what the house had on its cards and forgets the cells nobody is updating', () => {
    const was = heardEverything();

    const closed = endState(was, 'closed');

    expect(closed.connection).toBe('closed');
    expect(cellsHeld(closed.houses)).toEqual([]);
    expect([
      closed.yourHouse,
      closed.yourChoice,
      closed.yourKeyFigures,
      closed.yourHoldings,
      closed.yourSight,
      closed.yourDialogues,
    ]).toEqual([
      was.yourHouse,
      was.yourChoice,
      was.yourKeyFigures,
      was.yourHoldings,
      was.yourSight,
      was.yourDialogues,
    ]);
  });

  it('taken over, forgets the house too, because somebody else is playing it now', () => {
    const takenOver = endState(heardEverything(), 'takenOver');

    expect(takenOver.connection).toBe('takenOver');
    expect(cellsHeld(takenOver.houses)).toEqual([]);
    expect([
      takenOver.yourHouse,
      takenOver.yourChoice,
      takenOver.yourKeyFigures,
      takenOver.yourHoldings,
      takenOver.yourSight,
      takenOver.yourDialogues,
    ]).toEqual([null, null, null, null, null, null]);
  });

  it('a step refused is said under its dialogue, and an answer to anything else leaves it be', () => {
    const stepping = { commandId: 'c-1', dialogueId: 'd-1', lineId: 'accept' };
    const out: SessionState = { ...INITIAL_SESSION, acting: 'c-1', stepping };

    const refused = foldFrame(out, { type: 'commandRejected', commandId: 'c-1', reason: 'notEnoughFree' });
    expect([refused.acting, refused.stepping]).toEqual([null, null]);
    expect(refused.stepRefused).toEqual({ dialogueId: 'd-1', lineId: 'accept', reason: 'notEnoughFree' });

    const other = foldFrame(out, { type: 'commandAccepted', commandId: 'c-2' });
    expect([other.acting, other.stepping, other.stepRefused]).toEqual(['c-1', stepping, null]);
  });

  it('lets its listeners hear a frame with the state before and after, before and after what it does', () => {
    const heard: string[] = [];
    const socket = fakeSocket();
    const session = createSession({
      schedule: { after: () => () => undefined },
      newId: () => 'c-1',
      standsArrived: () => undefined,
      followStands: () => undefined,
      arriveAnew: () => heard.push('arrive anew'),
      note: (area, message) => heard.push(`${area}: ${message}`),
    });
    session.observe({
      connecting: (address) => heard.push(`connecting to ${address}`),
      heard: (frame, was, now) => heard.push(`heard ${frame.type}: ${was.connection} -> ${now.connection}`),
      done: (frame) => heard.push(`done ${frame.type}`),
      closed: () => heard.push('closed'),
    });

    session.connect({ socket: socket.socket, playerToken: 't', protocolVersion: 1, address: 'ws://here' });
    socket.opens();
    socket.says(welcome);
    socket.says({ type: 'worldWiped', message: 'the world was emptied' });
    socket.closes();

    expect(heard).toEqual([
      'connecting to ws://here',
      'heard welcome: connecting -> open',
      'done welcome',
      'heard worldWiped: open -> open',
      'arrive anew',
      'done worldWiped',
      'closed',
    ]);
    expect(session.state().connection).toBe('closed');
  });

  it('holds the two switches once, says them again at the welcome, and keeps them through an end', () => {
    const socket = fakeSocket();
    const session = createSession({
      schedule: { after: () => () => undefined },
      newId: () => 'c-1',
      standsArrived: () => undefined,
      followStands: () => undefined,
      arriveAnew: () => undefined,
      note: () => undefined,
    });
    expect(session.state()).toMatchObject({ seeAll: false, fogOfWar: true });

    let told = 0;
    session.watch(() => (told += 1));
    session.seeAll(true);
    session.fogOfWar(false);
    expect(session.state()).toMatchObject({ seeAll: true, fogOfWar: false });
    expect(told).toBe(2);

    session.connect({ socket: socket.socket, playerToken: 't', protocolVersion: 1, address: 'ws://here' });
    socket.opens();
    socket.says(welcome);
    expect(socket.sent.slice(1)).toEqual([
      { type: 'seeAll', on: true },
      { type: 'fogOfWar', on: false },
    ]);

    session.fogOfWar(true);
    expect(socket.sent.at(-1)).toEqual({ type: 'fogOfWar', on: true });
    socket.closes();
    expect(session.state()).toMatchObject({ connection: 'closed', seeAll: true, fogOfWar: true });
  });

  // A window on something the page knows nothing of asks once, and the answer is kept by subject. See 0088.
  it('asks after a subject once a connection, not before the welcome, and keeps the answer by subject', () => {
    const socket = fakeSocket();
    const session = createSession({
      schedule: { after: () => () => undefined },
      newId: () => 'c-1',
      standsArrived: () => undefined,
      followStands: () => undefined,
      arriveAnew: () => undefined,
      note: () => undefined,
    });
    session.connect({ socket: socket.socket, playerToken: 't', protocolVersion: 1, address: 'ws://here' });
    socket.opens();
    session.inspect('house', 'kestrel');
    expect(socket.sent.some((frame) => frame.type === 'inspect')).toBe(false);

    socket.says(welcome);
    session.inspect('house', 'kestrel');
    session.inspect('house', 'kestrel');
    session.inspect('character', 'kestrel');
    expect(socket.sent.filter((frame) => frame.type === 'inspect')).toEqual([
      { type: 'inspect', kind: 'house', id: 'kestrel' },
      { type: 'inspect', kind: 'character', id: 'kestrel' },
    ]);

    socket.says({ type: 'inspected', kind: 'house', id: 'kestrel' });
    expect(session.state().inspected['house:kestrel']).toEqual({
      type: 'inspected',
      kind: 'house',
      id: 'kestrel',
    });
    expect(session.state().inspected['character:kestrel']).toBeUndefined();

    // A connection anew asks again, because the answer may have changed while it was gone.
    socket.says(welcome);
    session.inspect('house', 'kestrel');
    expect(socket.sent.filter((frame) => frame.type === 'inspect')).toHaveLength(3);
  });

  it('asks what water is at a place only while open, and keeps the answer until a takeover', () => {
    const socket = fakeSocket();
    const session = createSession({
      schedule: { after: () => () => undefined },
      newId: () => 'c-1',
      standsArrived: () => undefined,
      followStands: () => undefined,
      arriveAnew: () => undefined,
      note: () => undefined,
    });
    session.inspectAt({ lat: 52.25, lon: 21 });
    expect(session.state().inspectedAt).toBeNull();

    session.connect({ socket: socket.socket, playerToken: 't', protocolVersion: 1, address: 'ws://here' });
    socket.opens();
    socket.says(welcome);
    session.inspectAt({ lat: 52.25, lon: 21 });
    expect(socket.sent.at(-1)).toEqual({ type: 'inspectAt', at: { lat: 52.25, lon: 21 } });

    const answer: ServerFrame = {
      type: 'inspectedAt',
      at: { lat: 52.25, lon: 21 },
      revealed: true,
      water: { kind: 'river', id: 'Q548', name: 'Vistula', also: 'Wisła', of1790: true },
    };
    socket.says(answer);
    expect(session.state().inspectedAt).toEqual(answer);
    socket.says({ type: 'takenOver', message: 'another window took this player over' });
    expect(session.state().inspectedAt).toBeNull();
  });
});
