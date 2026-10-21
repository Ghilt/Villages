import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';

import { startGame, stopGame, testPorts } from './servers.ts';

/**
 * Remember me, proven in Chrome as a player meets it: an account made from a guest through the settings; the browser
 * closed and opened again, which keeps only the cookies told to outlast it, signed in still when ticked and signed out
 * when not; two tabs that never sign each other out; and the game server stopped and started, which forgets no
 * sign-in. How long each kind lasts on the server is `SignInsSpec`'s, on a clock it moves by hand. See
 * docs/plans/accounts.md and decision records 0111 and 0112.
 */
test('remember me: kept through a closed browser when ticked and not when unticked, in two tabs, and through a restart', async ({
  browser,
}) => {
  // Made up for this run, in this test's own world: a test account, never anybody's.
  const email = `e2e-${randomUUID()}@example.com`;
  const password = `e2e ${randomUUID()}`;
  const first = await browser.newContext();
  const page = await first.newPage();

  await test.step('a guest makes an account through the settings, and is the same player', async () => {
    await page.goto('/');
    await expect.poll(async () => (await signedInAs(page)).guest).toBe(true);
    const guest = await signedInAs(page);
    await openSettings(page);
    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create the account' }).click();
    await expect.poll(async () => (await signedInAs(page)).email).toBe(email);
    expect((await signedInAs(page)).player).toBe(guest.player);
  });

  await test.step('ticked, the browser closed and opened again is still signed in', async () => {
    const again = await reopened(browser, first);
    const back = await again.newPage();
    await back.goto(ASKING);
    expect((await signedInAs(back)).email).toBe(email);
    await again.close();
  });

  await test.step('two tabs of one browser never sign each other out', async () => {
    const second = await first.newPage();
    await second.goto(ASKING);
    await page.reload();
    expect((await signedInAs(second)).email).toBe(email);
    expect((await signedInAs(page)).email).toBe(email);
    await second.close();
  });

  await test.step('unticked, the browser closed and opened again is signed out', async () => {
    // Signed in as the form does it, from a page with no map: a second whole game in a software-drawn browser is
    // minutes, and the form is the first step's.
    const forNow = await browser.newContext();
    const once = await forNow.newPage();
    await once.goto(ASKING);
    const entered = await once.evaluate(
      ([email, password]) =>
        fetch('/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, remember: false }),
        }).then((answer) => answer.status),
      [email, password],
    );
    expect(entered).toBe(200);
    expect((await signedInAs(once)).signIn?.keeping).toBe('forNow');

    const again = await reopened(browser, forNow);
    const back = await again.newPage();
    await back.goto(ASKING);
    expect((await signedInAs(back)).email).toBeNull();
    await again.close();
    await forNow.close();
  });

  await test.step('a restart of the game server forgets no sign-in', async () => {
    if (process.env['E2E_STORE'] !== 'mongo') {
      test.info().annotations.push({
        type: 'not run',
        description: 'the restart: Docker is not running, so the sign-ins are in memory',
      });
      return;
    }
    const { game } = testPorts();
    await stopGame(game);
    await startGame(game, {
      store: 'mongo',
      broker: process.env['E2E_BROKER'] === 'rabbit' ? 'rabbit' : 'in-process',
      database: process.env['E2E_DATABASE']!,
    });
    await page.reload();
    await expect.poll(async () => (await signedInAs(page)).email).toBe(email);
  });
});

/**
 * A page of the game's own address with no map on it, to ask who a browser is from: the cookie is the address's,
 * whichever page asks, and loading the whole game for each would make the test minutes long.
 */
const ASKING = '/admin';

/**
 * Opens the settings from their mark, once the loading screen has lifted, which it does within twelve seconds of the
 * page opening: pressed again until the dialog is open, because a press while the screen is still fading lands on it.
 */
async function openSettings(page: Page): Promise<void> {
  await expect(page.locator('.ui-loading[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await expect(async () => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
}

/** Who the page's browser is signed in as, as the game server's `/auth/me` answers it. */
async function signedInAs(page: Page): Promise<{
  player: string | null;
  guest: boolean;
  email: string | null;
  signIn: { keeping: string } | null;
}> {
  // A page loading again, as one does once it signs in, is asked again once it has.
  for (;;) {
    await page.waitForLoadState('domcontentloaded');
    try {
      return await page.evaluate(() => fetch('/auth/me').then((answer) => answer.json()));
    } catch (lost) {
      if (!String(lost).includes('Execution context was destroyed')) throw lost;
    }
  }
}

/**
 * The browser of [context] closed and opened again: a context of its own with only the cookies that were told to
 * outlast the browser, as a browser keeps them. A cookie with no lifetime of its own goes with the browser.
 */
async function reopened(browser: Browser, context: BrowserContext): Promise<BrowserContext> {
  const { cookies } = await context.storageState();
  return browser.newContext({
    storageState: { cookies: cookies.filter((one) => one.expires > 0), origins: [] },
  });
}
