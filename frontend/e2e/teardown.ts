import { deleteVirtualHost, dropDatabase, stopGame, testPorts } from './servers.ts';

/** Stops the test's game server and drops its world and its virtual host, however the tests went. */
export default async function teardown(): Promise<void> {
  await stopGame(testPorts().game);
  if (process.env['E2E_STORE'] === 'mongo') dropDatabase(process.env['E2E_DATABASE']!);
  if (process.env['E2E_BROKER'] === 'rabbit') await deleteVirtualHost(process.env['E2E_DATABASE']!);
}
