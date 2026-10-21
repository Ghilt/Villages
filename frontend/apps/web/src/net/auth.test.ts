import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Signing in before the socket opens, as the page does it once a load: asking the game server's `/auth` who this
 * browser is, and making a newcomer a guest, of the player it kept in local storage before there were sign-ins when it
 * kept one. See decision record 0109.
 */

const OLD = '0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d';

/** What the page asked, in order: how, where, and what it sent. */
const asked: { method: string; path: string; body: unknown }[] = [];
let kept: Map<string, string>;

/** The game server, answering each path with what [answers] says for it. */
function server(answers: Record<string, unknown>) {
  vi.stubGlobal('fetch', (path: string, init?: RequestInit) => {
    asked.push({
      method: init?.method ?? 'GET',
      path,
      body: init?.body === undefined ? undefined : (JSON.parse(String(init.body)) as unknown),
    });
    const answer = answers[path];
    return answer === undefined
      ? Promise.reject(new TypeError('Failed to fetch'))
      : Promise.resolve(new Response(JSON.stringify(answer)));
  });
}

const settings = { motion: 'device', language: 'en' };
const nobody = {
  player: null,
  house: null,
  guest: false,
  through: [],
  password: false,
  signIn: null,
  settings,
};
const guest = (player: string) => ({
  player,
  house: 'h',
  guest: true,
  signIn: { id: 's', keeping: 'guest', browser: 'Chrome on Windows', ends: 0 },
  settings,
});

beforeEach(() => {
  asked.length = 0;
  kept = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => kept.set(key, value),
    removeItem: (key: string) => kept.delete(key),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function load() {
  vi.resetModules();
  const log = await import('../log/log');
  return {
    auth: await import('./auth'),
    said: () => log.logStore.get().notes.map((n) => `${n.area}: ${n.message}`),
  };
}

describe('signing the browser in', () => {
  it('asks who the browser is, and asks nothing more of a browser already signed in', async () => {
    server({ '/auth/me': guest('p1') });
    const { auth } = await load();

    expect((await auth.signIn()).player).toBe('p1');
    expect(asked.map((one) => `${one.method} ${one.path}`)).toEqual(['GET /auth/me']);
    expect(auth.meStore.get().me?.player).toBe('p1');
  });

  it('makes a newcomer a guest of the player it kept before sign-ins, and forgets that player once it is', async () => {
    kept.set('villages.playerToken', OLD);
    server({ '/auth/me': nobody, '/auth/guest': guest(OLD) });
    const { auth, said } = await load();

    expect((await auth.signIn()).player).toBe(OLD);
    expect(asked.at(-1)).toEqual({ method: 'POST', path: '/auth/guest', body: { adopt: OLD } });
    expect(kept.has('villages.playerToken')).toBe(false);
    expect(said().at(-1)).toMatch(/is its guest now, house and all/);
  });

  it('keeps the old player for another try when the server does not answer, and leaves the page nobody', async () => {
    kept.set('villages.playerToken', OLD);
    server({ '/auth/me': nobody });
    const { auth, said } = await load();

    expect((await auth.signIn()).player).toBeNull();
    expect(kept.get('villages.playerToken')).toBe(OLD);
    expect(said().at(-1)).toBe('player: could not sign in: Failed to fetch');
  });

  it("moves the world as the player's settings say, as soon as it knows them", async () => {
    server({ '/auth/me': { ...guest('p1'), settings: { motion: 'still', language: 'en' } } });
    const { auth } = await load();
    const motion = await import('../motion/motion');

    await auth.signIn();
    expect(motion.worldStill()).toBe(true);
  });

  it('signs in once a page, however many ask', async () => {
    server({ '/auth/me': guest('p1') });
    const { auth } = await load();

    await Promise.all([auth.signIn(), auth.signIn(), auth.signIn()]);
    expect(asked).toHaveLength(1);
  });
});
