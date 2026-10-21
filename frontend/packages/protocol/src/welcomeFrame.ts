import { z } from 'zod';

import { worldDaySchema } from './basics';

/**
 * The answer to hello: the server's time and the player's id, where the world's clock stands, and while the instruments
 * are open where the world is kept and how many settlements it has. Its own module so the frames' list stays one size.
 */
export const welcomeFrameSchema = z.object({
  type: z.literal('welcome'),
  serverTime: z.number().int(),
  playerId: z.string(),
  /** Where the world's clock stands: today, and the earliest day anything is known to exist from. */
  world: z.object({ today: worldDaySchema, earliest: worldDaySchema }),
  /** Where the world is kept - in memory, or which database - said only while the instruments are open (0092). */
  keptIn: z.string().nullable().optional(),
  /**
   * The world's settlements counted, while the instruments are open: the master's sites, the settlements standing on
   * them, the sites passed over for a seat, and the settlements standing on no site, left by a repaint (0114).
   */
  settlements: z
    .object({
      sites: z.number().int(),
      standing: z.number().int(),
      passedOver: z.number().int(),
      buildings: z.number().int(),
    })
    .nullable()
    .optional(),
});
