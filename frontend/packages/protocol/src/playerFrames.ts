import { z } from 'zod';

/**
 * How the debug panel lists the players of the world, to switch this browser to one: a player is a token until
 * accounts exist (0008), so knowing one is enough to play as it. Instruments, refused while they are closed, and never
 * a player's. See `frames.ts`, and decision record 0101.
 */

/** Ask who plays in this world: answered by `playersListed`. */
export const listPlayersSchema = z.object({ type: z.literal('listPlayers') });

/** One player of the world: the player's id, which is their token, and the name of the house they founded. */
export const playerViewSchema = z.object({ player: z.string(), house: z.string() });

/** Every player with a house in this world, by the house's name. */
export const playersListedSchema = z.object({
  type: z.literal('playersListed'),
  players: z.array(playerViewSchema),
});

/** The client's and the server's frames of the players, as `frames.ts` lists them in its unions. */
export const playerClientFrames = [listPlayersSchema] as const;
export const playerServerFrames = [playersListedSchema] as const;

export type PlayerView = z.infer<typeof playerViewSchema>;
