import { connect } from '@villages/client-core';
import { PROTOCOL_VERSION } from '@villages/protocol';
import type { BannerSpec, Point } from '@villages/protocol';

import { note } from '../log/log';
import { browserSocket } from './browserSocket';
import { GATEWAY_URL } from './gateway';

/**
 * Founding houses as other players, one house each.
 *
 * A player founds one house and plays from one place (decision record 0028), so seeding a region cannot
 * be one session founding twenty times - that is one house and nineteen refusals. It is twenty players
 * with one house apiece, which is what seeding a world means anyway. Each opens a short connection with a
 * freshly made token, founds, and goes.
 *
 * Deliberately the real path: hello, a command, the same schema checks as any other client, and no
 * privileged "found as anyone" frame that would exist only for this. It is also the shape the NPC houses
 * in docs/SETTING.md will take - an NPC house is a house, and the difference is who issues its commands.
 */
export interface Seedling {
  name: string;
  seat: Point;
  banner: BannerSpec;
}

/** How long to wait for one seeded house to be accepted before giving up on it. */
const PATIENCE_MS = 5000;

/** Founds one house as a player who exists only to found it. Resolves when accepted or refused. */
export function foundAsSomeoneNew(seedling: Seedling): Promise<boolean> {
  return new Promise((settle) => {
    const socket = browserSocket(GATEWAY_URL);
    const connection = connect({
      socket,
      playerToken: crypto.randomUUID(),
      protocolVersion: PROTOCOL_VERSION,
    });

    let done = false;
    const finish = (accepted: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(patience);
      connection.close();
      settle(accepted);
    };
    const patience = setTimeout(() => {
      note('seed', `${seedling.name} was never answered`);
      finish(false);
    }, PATIENCE_MS);

    connection.onFrame((frame) => {
      if (frame.type === 'welcome') {
        connection.send({
          type: 'command',
          // A UUID like any other command's: the gateway refuses anything else, because this id is
          // the causation of the events the command writes. See decision record 0035.
          commandId: crypto.randomUUID(),
          command: { type: 'foundHouse', name: seedling.name, seat: seedling.seat, banner: seedling.banner },
        });
        return;
      }
      if (frame.type === 'commandAccepted') {
        finish(true);
      } else if (frame.type === 'commandRejected') {
        note('seed', `${seedling.name} was refused: ${frame.reason}`);
        finish(false);
      }
    });
  });
}

/** Founds a whole set, and says how many took. */
export async function seedHouses(seedlings: readonly Seedling[]): Promise<number> {
  const taken = await Promise.all(seedlings.map(foundAsSomeoneNew));
  return taken.filter(Boolean).length;
}
