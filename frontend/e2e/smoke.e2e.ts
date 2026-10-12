import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { startGame, stopGame, testPorts } from './servers.ts';

/**
 * The game end to end, as a player meets it: the map drawn, a house founded from the parchment, a second window
 * seeing the founding as it happens, and the house still the player's after the game server is stopped and started
 * again. What it reads is what Adam reads, the debug panel's log; what it presses is what a player presses.
 */
test('the map, a house founded, another window seeing it, and a restart that forgets nothing', async ({
  browser,
}) => {
  const player = await (await browser.newContext()).newPage();
  const watcher = await (await browser.newContext()).newPage();
  let name = '';

  await test.step('the map is drawn, from the world this tree has cut', async () => {
    await player.goto('/');
    await expect(player.locator('canvas.maplibregl-canvas')).toBeVisible();
    await logSays(player, 'drawing the master called');
    // A line's area and what it says sit side by side with nothing between them: renderer, painted.
    await logSays(player, /renderer\s*painted/);
    await logSays(player, 'welcome: player');
  });

  await test.step('another window watches the world happening', async () => {
    await watcher.goto('/admin/inspect-events');
    await expect(watcher.locator('.log__link--open')).toBeVisible();
  });

  await test.step('a house is founded from the first seat the parchment offers', async () => {
    const seat = player.locator('button.parchment').first();
    await expect(seat).toBeVisible();
    name = /take the name (\w+)/.exec(await seat.innerText())?.[1] ?? '';
    expect(name, 'the seat says which house it would found').not.toBe('');
    await seat.click();
    await logSays(player, `your house is ${name}`);
  });

  await test.step('the other window sees the founding as it is stored', async () => {
    await expect(watcher.locator('.log__entry', { hasText: name }).first()).toBeAttached();
  });

  await test.step('a restart of the game server forgets nothing', async () => {
    if (process.env['E2E_STORE'] !== 'mongo') {
      // Said rather than skipped, which would mark the steps above as never run.
      test.info().annotations.push({
        type: 'not run',
        description: 'the restart: Docker is not running, so the world is in memory',
      });
      return;
    }
    const { game } = testPorts();
    await stopGame(game);
    await startGame(game, 'mongo', process.env['E2E_DATABASE']!);
    await player.reload();
    await logSays(player, `your house is ${name}`);
    await expect(player.locator('button.parchment')).toHaveCount(0);
  });
});

/** Waits until the debug panel's log has a line saying `text`, opening the log first if it is shut. */
async function logSays(page: Page, text: string | RegExp): Promise<void> {
  const show = page.getByRole('button', { name: 'Show the debug panel' });
  if (await show.isVisible()) await show.click();
  const log = page.getByRole('button', { name: 'log', exact: true });
  if ((await log.getAttribute('aria-pressed')) !== 'true') await log.click();
  await expect(page.locator('li', { hasText: text }).first()).toBeAttached();
}
