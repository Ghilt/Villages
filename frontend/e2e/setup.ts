import { answers, dropDatabase, mongoIsUp, startGame, testDatabase, testPorts } from './servers.ts';

/**
 * Starts the test's own game server before any test: in MongoDB, in a world of the test's own emptied first, when
 * the stack in infra/ is up; in memory otherwise, when the restart is skipped. What it chose is handed to the tests
 * in the environment, which Playwright passes on to them.
 */
export default async function setup(): Promise<void> {
  const { game, tree } = testPorts();
  if (await answers(game))
    throw new Error(`something already answers on ${game}, the test's game port; is a test already running?`);
  const store = mongoIsUp() ? 'mongo' : 'memory';
  const database = testDatabase(tree);
  if (store === 'mongo') dropDatabase(database);
  process.env['E2E_STORE'] = store;
  process.env['E2E_DATABASE'] = database;
  await startGame(game, store, database);
}
