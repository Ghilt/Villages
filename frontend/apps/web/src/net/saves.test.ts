import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeSocket } from '@villages/client-core/testing';
import type { FakeSocket } from '@villages/client-core/testing';

/*
 * The page's side of the world's saves: saving, listing and loading one through `gateway.ts` whole, over a socket the
 * test plays the gateway through, as `gateway.test.ts` drives the rest of the conversation. See decision record 0101.
 */

const fake = vi.hoisted(() => ({ current: undefined as FakeSocket | undefined }));
vi.mock('./browserSocket', () => ({ browserSocket: () => fake.current!.socket }));
vi.mock('./stands', () => ({ followStandsUnder: () => undefined, standsArrived: () => undefined }));

/** A server frame from the shared fixtures, which both ends are held to. */
function fixture(name: string): Record<string, unknown> {
  const at = new URL(`../../../../../contracts/fixtures/frames/server/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(at, 'utf8')) as Record<string, unknown>;
}

beforeEach(() => {
  const kept = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => kept.set(key, value),
    removeItem: (key: string) => kept.delete(key),
  });
  vi.stubGlobal('window', { location: { reload: vi.fn() } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A page fresh from loading, connected and welcomed, with its log. */
async function arrived() {
  vi.resetModules();
  fake.current = fakeSocket();
  const log = await import('../log/log');
  const gateway = await import('./gateway');
  gateway.observeGateway((await import('../sessionLog')).sessionLog);
  const socket = fake.current;
  gateway.gateway('terrain');
  socket.opens();
  socket.says(fixture('welcome'));
  return {
    gateway,
    socket,
    said: (from = 0) =>
      log.logStore
        .get()
        .notes.slice(from)
        .map((n) => `${n.area}: ${n.message}`),
    lines: () => log.logStore.get().notes.length,
  };
}

describe("the page's saves of the world", () => {
  it('says the save it asked for, as the gateway lists it, and a refused one as the error it is', async () => {
    const page = await arrived();
    const before = page.lines();

    page.gateway.saveWorld('completed-many-quests');
    page.socket.says(fixture('savesListed'));
    page.socket.says({
      type: 'error',
      code: 'saveRefused',
      message: 'there is a save called first-test already',
    });

    expect(page.socket.sent.at(-1)).toEqual({ type: 'saveWorld', name: 'completed-many-quests' });
    expect(page.said(before)).toEqual([
      'world: saving the world as completed-many-quests',
      'world: saved the world as completed-many-quests: 412 events',
      'gateway: error saveRefused: there is a save called first-test already',
    ]);
  });

  it('loads a save and arrives anew as the player who made it, and a refused load changes nobody', async () => {
    const page = await arrived();
    const was = localStorage.getItem('villages.playerToken');
    page.gateway.listSaves();
    expect(page.socket.sent.at(-1)).toEqual({ type: 'listSaves' });
    page.socket.says({ ...fixture('savesListed'), saved: null });

    page.gateway.loadSave('never-made');
    page.socket.says({ type: 'error', code: 'saveRefused', message: 'there is no save called never-made' });
    page.gateway.loadSave('completed-many-quests');
    expect(page.socket.sent.at(-1)).toEqual({ type: 'loadSave', name: 'completed-many-quests' });
    expect(localStorage.getItem('villages.playerToken')).toBe(was);

    page.socket.says({
      type: 'worldWiped',
      message: 'the world is the save completed-many-quests now, 412 events',
    });

    expect(localStorage.getItem('villages.playerToken')).toBe('0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d');
    expect(window.location.reload).toHaveBeenCalledOnce();
  });
});
