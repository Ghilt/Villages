import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeSocket } from '@villages/client-core/testing';
import type { FakeSocket } from '@villages/client-core/testing';
import { PROTOCOL_VERSION } from '@villages/protocol';

/*
 * The page's conversation with the gateway, written down as it stands before any of it moves: what is sent, what
 * is said in the log and in what order, and what the state is, for each turn the conversation takes. It drives
 * `gateway.ts` whole over a socket the test plays the gateway through, so it holds whatever takes its place to
 * the same conversation.
 */

const fake = vi.hoisted(() => ({ current: undefined as FakeSocket | undefined }));
const stands = vi.hoisted(() => ({ followed: [] as string[][] }));
vi.mock('./browserSocket', () => ({ browserSocket: () => fake.current!.socket }));
vi.mock('./stands', () => ({
  followStandsUnder: (cells: string[]) => stands.followed.push(cells),
  standsArrived: () => undefined,
}));

/** A server frame from the shared fixtures, which both ends are held to. */
function fixture(name: string): Record<string, unknown> {
  const at = new URL(`../../../../../contracts/fixtures/frames/server/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(at, 'utf8')) as Record<string, unknown>;
}

const empty = (cell: string) => ({ type: 'snapshot', cell, houses: [], asOfVersion: 0 });

const Z8 = ['12003122', '12003123'];
const Z9 = ['120031220', '120031221'];
const Z10 = ['1200312200', '1200312201'];

beforeEach(() => {
  vi.useFakeTimers();
  const kept = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => kept.set(key, value),
    removeItem: (key: string) => kept.delete(key),
  });
  vi.stubGlobal('window', { location: { reload: vi.fn() } });
  stands.followed = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A page fresh from loading: its own gateway module, its own log, and a socket not yet open. */
async function load() {
  vi.resetModules();
  fake.current = fakeSocket();
  const log = await import('../log/log');
  const gateway = await import('./gateway');
  // The log listens to the conversation as the page's start makes it.
  gateway.observeGateway((await import('../sessionLog')).sessionLog);
  const socket = fake.current;
  return {
    gateway,
    socket,
    /** The log, as area and line, from the first line after [from]. */
    said: (from = 0) =>
      log
        .notesNow()
        .slice(from)
        .map((n) => `${n.area}: ${n.message}`),
    lines: () => log.notesNow().length,
    /** What the page has sent, from the first frame after [from]. */
    sent: (from = 0) => socket.sent.slice(from),
  };
}

/** A page that has connected and been welcomed, following the z8 cells, with each one answered. */
async function arrived() {
  const page = await load();
  page.gateway.follow(Z8);
  page.gateway.gateway('terrain');
  page.socket.opens();
  page.socket.says(fixture('welcome'));
  page.socket.says(empty(Z8[0]!));
  page.socket.says(empty(Z8[1]!));
  vi.advanceTimersByTime(300);
  return page;
}

describe("the page's conversation with the gateway", () => {
  it('says hello as the socket opens, and asks for what the camera wanted only once it is welcomed', async () => {
    const page = await load();
    page.gateway.follow(Z8);
    page.gateway.gateway('terrain');

    expect(page.sent()).toEqual([]);
    page.socket.opens();
    const token = page.gateway.gatewayState().playerToken;
    expect(page.sent()).toEqual([
      { type: 'hello', playerToken: token, protocolVersion: PROTOCOL_VERSION, master: 'terrain' },
    ]);

    page.socket.says(fixture('welcome'));
    expect(page.sent(1)).toEqual([{ type: 'subscribeCells', cells: Z8 }]);
    expect(page.gateway.gatewayState().connection).toBe('open');
    expect(page.gateway.gatewayState().world).toEqual({ today: 454901, earliest: 437635 });
    expect(page.said()).toEqual([
      'gateway: connecting to ws://localhost:8080/ws',
      'gateway: welcome: player a1b2c3d4, server time 2026-09-05T12:00:00.200Z',
      'world: today is the twenty-fourth of June, year 1246; the earliest thing is from the seventeenth of March, year 1199',
    ]);
  });

  it('opens the eye and lifts the fog before it asks for a cell, when they were asked for before the welcome', async () => {
    const page = await load();
    page.gateway.seeAll(true);
    page.gateway.fogOfWar(false);
    page.gateway.follow(Z8);
    page.gateway.gateway('terrain');
    page.socket.opens();
    page.socket.says(fixture('welcome'));

    expect(page.sent(1)).toEqual([
      { type: 'seeAll', on: true },
      { type: 'fogOfWar', on: false },
      { type: 'subscribeCells', cells: Z8 },
    ]);
  });

  it('says what a burst of snapshots brought once it stops, and nothing for a burst that brought nothing', async () => {
    const page = await load();
    page.gateway.follow(Z8);
    page.gateway.gateway('terrain');
    page.socket.opens();
    page.socket.says(fixture('welcome'));
    const before = page.lines();

    page.socket.says(empty(Z8[1]!));
    page.socket.says(fixture('snapshot'));
    expect(page.said(before)).toEqual([]);
    vi.advanceTimersByTime(300);

    expect(page.said(before)).toEqual(['cells: 2 cells at z8: 2 houses']);
    expect(page.gateway.gatewayState().houses).not.toBe(undefined);
  });

  it('on a zoom step, asks for the new cells, and lets the old go only once every new one has answered', async () => {
    const page = await arrived();
    const sent = page.socket.sent.length;
    const before = page.lines();

    page.gateway.follow(Z9);
    expect(page.sent(sent)).toEqual([
      { type: 'unsubscribeCells', cells: Z8 },
      { type: 'subscribeCells', cells: Z9 },
    ]);

    page.socket.says(empty(Z9[0]!));
    // The second of the two movement events a step fires asks for nothing, and lets nothing go early.
    page.gateway.follow(Z9);
    expect(page.sent(sent + 2)).toEqual([]);
    expect(page.said(before)).toEqual([]);

    page.socket.says(empty(Z9[1]!));
    expect(page.said(before)).toEqual(['cells: let go of 2 cells now that what replaces them has arrived']);
    expect(stands.followed.at(-1)).toEqual(Z9);
  });

  it('lets the old cells go two seconds after a zoom step if the new ones never answer', async () => {
    const page = await arrived();
    const before = page.lines();

    page.gateway.follow(Z9);
    vi.advanceTimersByTime(1999);
    expect(page.said(before)).toEqual([]);
    vi.advanceTimersByTime(1);

    expect(page.said(before)).toEqual([
      'cells: let go of 2 cells after waiting for what should have replaced them',
    ]);
  });

  it('lets go at once of cells nothing is asked for to replace, as a pan off the edge of the world does', async () => {
    const page = await arrived();
    const sent = page.socket.sent.length;
    const before = page.lines();

    page.gateway.follow([Z8[0]!]);

    expect(page.sent(sent)).toEqual([{ type: 'unsubscribeCells', cells: [Z8[1]!] }]);
    expect(page.said(before)).toEqual(['cells: let go of 1 cell with nothing asked for to replace them']);
  });

  it('after a refused subscription forgets the cells that never came, and asks again for what it let go', async () => {
    const page = await arrived();
    page.gateway.follow(Z9);
    page.socket.says(empty(Z9[0]!));
    page.socket.says(empty(Z9[1]!));
    const sent = page.socket.sent.length;
    const before = page.lines();

    page.gateway.follow(Z10);
    page.socket.says(fixture('error'));

    expect(page.sent(sent)).toEqual([
      { type: 'unsubscribeCells', cells: Z9 },
      { type: 'subscribeCells', cells: Z10 },
      { type: 'subscribeCells', cells: Z9 },
    ]);
    expect(page.said(before)).toEqual([
      'gateway: error tooManyCells: at most 64 cells may be subscribed at once; zoom in',
      'cells: the gateway refused tooManyCells: forgot 2 that never came, asking again for 2',
    ]);
  });

  it('asks again for the cells of a resync, which the gateway has let go', async () => {
    const page = await arrived();
    const sent = page.socket.sent.length;
    const before = page.lines();

    page.socket.says(fixture('resync'));

    expect(page.sent(sent)).toEqual([{ type: 'subscribeCells', cells: ['12003122', '12003123'] }]);
    expect(page.said(before)).toEqual(['cells: fell behind; asking again for 2 cells']);
  });

  it("takes one option at a time, and files each command's answer beside the line that asked", async () => {
    const page = await arrived();
    page.socket.says(fixture('yourChoice'));
    const choice = page.gateway.gatewayState().yourChoice!;
    const sent = page.socket.sent.length;
    const before = page.lines();

    page.gateway.takeOption(choice, choice.options[0]!);
    page.gateway.takeOption(choice, choice.options[1]!);
    const [taking] = page.sent(sent) as { commandId: string }[];
    expect(page.sent(sent)).toEqual([
      {
        type: 'command',
        commandId: taking!.commandId,
        command: { type: 'takeAction', choiceId: choice.id, optionId: choice.options[0]!.id },
      },
    ]);
    expect(page.gateway.gatewayState().acting).toBe(taking!.commandId);

    page.socket.says({ type: 'commandAccepted', commandId: taking!.commandId });
    expect(page.gateway.gatewayState().acting).toBe(null);

    page.gateway.pull('resources', 'granting 100 wealth', {
      type: 'grantResource',
      resource: 'wealth',
      amount: 100,
    });
    const granting = (page.socket.sent.at(-1) as { commandId: string }).commandId;
    page.socket.says({ type: 'commandRejected', commandId: granting, reason: 'noSuchHouse' });
    page.socket.says({ type: 'commandAccepted', commandId: '00000000-0000-4000-8000-000000000000' });

    const short = (id: string) => id.slice(0, 8);
    expect(page.said(before)).toEqual([
      `command: taking "Skarnholt, in the northern reaches" as ${short(taking!.commandId)}`,
      `command: command ${short(taking!.commandId)} accepted`,
      `resources: granting 100 wealth as ${short(granting)}`,
      `resources: command ${short(granting)} rejected: noSuchHouse`,
      'gateway: command 00000000 accepted',
    ]);
  });

  it('says under a dialogue why a step was refused, and takes nothing else while one is out', async () => {
    const page = await arrived();
    const dialogue = 'dd000000-0000-4000-8000-00000000a001';
    const before = page.lines();

    page.gateway.completeDialogueStep(dialogue, 'accept', 'the option "accept"');
    const stepping = (page.socket.sent.at(-1) as { commandId: string }).commandId;
    page.gateway.completeDialogueStep(dialogue, 'ask', 'the option "ask"');
    expect((page.socket.sent.at(-1) as { commandId: string }).commandId).toBe(stepping);

    page.socket.says({ type: 'commandRejected', commandId: stepping, reason: 'notEnoughFree' });

    expect(page.gateway.gatewayState().stepRefused).toEqual({
      dialogueId: dialogue,
      lineId: 'accept',
      reason: 'notEnoughFree',
    });
    expect(page.gateway.gatewayState().acting).toBe(null);
    expect(page.said(before)).toEqual([
      `dialogues: taking the option "accept" as ${stepping.slice(0, 8)}`,
      `dialogues: command ${stepping.slice(0, 8)} rejected: notEnoughFree`,
    ]);
  });

  it("says what changed in the house's key figures, its sight and its dialogues, and keeps the latest", async () => {
    const page = await arrived();
    const before = page.lines();

    page.socket.says(fixture('yourKeyFigures'));
    const figures = fixture('yourKeyFigures') as {
      keyFigures: { stats: Record<string, number>; version: number }[];
    };
    figures.keyFigures[0]!.stats.piety = 14;
    figures.keyFigures[0]!.version = 5;
    page.socket.says(figures);
    page.socket.says(fixture('yourSight'));
    page.socket.says(fixture('yourDialogues'));
    page.socket.says(fixture('yourHouse'));

    expect(page.said(before)).toEqual([
      'characters: 2 key figures: Agnes Hollin, a woman of 0; Wilhelm Ystad, a man of 0',
      'characters: Agnes Hollin: piety went from 13 to 14',
      'sight: the seat, Agnes Hollin and the vision given at 55.68, 12.57 give vision, 34 km around each; 4 places seen from in all',
      'dialogues: "A letter from the coast": 1 line to read, up to the next step',
      'dialogues: "A second letter": 1 line to read, then a dialogue choice of 3',
      'dialogues: "The dues": finished, 1 line said',
      'dialogues: "A letter never answered": lost, 0 lines said: Agnes Hollin died',
      'house: your house is Ravenscar',
    ]);
    const state = page.gateway.gatewayState();
    expect(state.yourKeyFigures?.[0]?.stats.piety).toBe(14);
    expect(state.yourSight?.points).toHaveLength(4);
    expect(state.yourDialogues).toHaveLength(4);
    expect(state.yourHouse?.house.name).toBe('Ravenscar');
  });

  it('taken over, forgets the house and closes its own socket without saying the backend has gone', async () => {
    const page = await arrived();
    page.socket.says(fixture('yourHouse'));
    const before = page.lines();

    page.socket.says(fixture('takenOver'));

    expect(page.socket.closedByClient()).toBe(true);
    const state = page.gateway.gatewayState();
    expect(state.connection).toBe('takenOver');
    expect([
      state.yourHouse,
      state.yourChoice,
      state.yourKeyFigures,
      state.yourSight,
      state.yourDialogues,
    ]).toEqual([null, null, null, null, null]);
    expect(page.said(before)).toEqual([
      'gateway: another window took this player over; this window is no longer playing',
    ]);
  });

  it('when the socket closes from the other end, says so, and forgets the cells but keeps what the house had', async () => {
    const page = await arrived();
    page.socket.says(fixture('yourHouse'));
    const before = page.lines();

    page.socket.closes();

    const state = page.gateway.gatewayState();
    expect(state.connection).toBe('closed');
    expect(state.yourHouse?.house.name).toBe('Ravenscar');
    expect(page.said(before)).toEqual([
      'gateway: the connection closed; is the backend running? cd backend then ./gradlew :app:bootRun',
    ]);
  });
});
