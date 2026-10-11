import { z } from 'zod';

/** The small shapes every frame is made of. See `frames.ts` for what a frame is. */

/** A quadkey at zoom 8: eight digits, each 0 to 3. */
/** A cell at any zoom the grid has: the empty string is the whole world, ten digits the deepest tile. */
export const cellSchema = z.string().regex(/^[0-3]{0,10}$/);

export const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const tinctureSchema = z.enum(['or', 'argent', 'gules', 'azure', 'sable', 'vert', 'purpure']);
export const divisionSchema = z.enum(['plain', 'perPale', 'perFess', 'quarterly']);
export const chargeSchema = z.enum(['tower', 'stag', 'star']);

export const bannerSchema = z.object({
  field: tinctureSchema,
  division: divisionSchema,
  second: tinctureSchema.optional(),
  charge: chargeSchema,
  chargeTincture: tinctureSchema,
});

/**
 * How much of one resource a house has. Clients interpolate: total plus ratePerSecond times the seconds
 * since asOf, and what is free is that less `pledged`.
 *
 * `pledged` is summed by the gateway from the live pledges and stored nowhere as a number; it is on the
 * wire so the browser does not have to add up a list to draw one figure.
 */
export const stockSchema = z.object({
  total: z.number().int(),
  pledged: z.number().int().nonnegative(),
  ratePerSecond: z.number(),
  asOf: z.number().int(),
});

/**
 * What the five resources are called on the wire: the code's names, not the player's.
 *
 * `naturalDomain` is shown to a player as Domain - the code qualifies it because `domain` already names
 * the innermost layer of the server. Which word is shown is the interface's to decide, and it decides it
 * in one place. See the naming rule in `BUILDING-A-MECHANIC.md`.
 */
export const resourceNameSchema = z.enum(['wealth', 'naturalDomain', 'influence', 'reason', 'piety']);

/** A day in the world's calendar, counted from the first day of year one. The calendar reads it. */
export const worldDaySchema = z.number().int().nonnegative();

export type Point = z.infer<typeof pointSchema>;
export type Tincture = z.infer<typeof tinctureSchema>;
export type Division = z.infer<typeof divisionSchema>;
export type Charge = z.infer<typeof chargeSchema>;
export type BannerSpec = z.infer<typeof bannerSchema>;
export type Stock = z.infer<typeof stockSchema>;
export type ResourceName = z.infer<typeof resourceNameSchema>;

/** A house holding something - a key figure, a structure - named the way a view of the tie needs it. */
export const holderViewSchema = z.object({ id: z.string(), name: z.string(), banner: bannerSchema });
