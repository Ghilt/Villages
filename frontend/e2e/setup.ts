import {
  answers,
  deleteVirtualHost,
  dropDatabase,
  stackHas,
  startGame,
  testDatabase,
  testPorts,
} from './servers.ts';
import type { Keeping } from './servers.ts';

/**
 * Starts the test's own game server before any test: in MongoDB, in a world of the test's own emptied first, and
 * carried by RabbitMQ in a virtual host of the test's own, when the stack in infra/ is up; in memory otherwise, when
 * the restart is skipped. What it chose is handed to the tests in the environment, which Playwright passes on.
 */
export default async function setup(): Promise<void> {
  const { game, tree } = testPorts();
  if (await answers(game))
    throw new Error(`something already answers on ${game}, the test's game port; is a test already running?`);
  const store = stackHas('mongodb') ? 'mongo' : 'memory';
  const keeping: Keeping = {
    store,
    broker: store === 'mongo' && stackHas('rabbitmq') ? 'rabbit' : 'in-process',
    database: testDatabase(tree),
  };
  if (keeping.store === 'mongo') dropDatabase(keeping.database);
  if (keeping.broker === 'rabbit') await deleteVirtualHost(keeping.database);
  process.env['E2E_STORE'] = keeping.store;
  process.env['E2E_BROKER'] = keeping.broker;
  process.env['E2E_DATABASE'] = keeping.database;
  await startGame(game, keeping);
}
