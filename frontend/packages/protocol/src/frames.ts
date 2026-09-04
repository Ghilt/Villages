import { z } from 'zod';

/**
 * The frames that cross the WebSocket, as zod schemas, so that a frame is checked at the edge and typed
 * inside. Mirrored in Kotlin under backend/protocol, and both sides are tested against the same fixtures in
 * contracts/fixtures/frames, which own the format.
 *
 * Times are the server's clock in milliseconds since the epoch. Optional fields are absent rather than
 * null. Heraldry is spelled the way the interface shows it.
 */

/** A quadkey at zoom 8: eight digits, each 0 to 3. */
export const cellSchema = z.string().regex(/^[0-3]{8}$/);

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

/** A resource as a rate. Clients interpolate: amount plus ratePerSecond times the seconds since asOf. */
export const rateSchema = z.object({
  amount: z.number().int(),
  ratePerSecond: z.number(),
  asOf: z.number().int(),
});

export const houseViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  cell: cellSchema,
  seat: pointSchema,
  banner: bannerSchema,
  treasury: rateSchema,
  version: z.number().int(),
});

export const commandPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('foundHouse'),
    houseId: z.string(),
    name: z.string(),
    seat: pointSchema,
    banner: bannerSchema,
  }),
]);

export const clientFrameSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), playerToken: z.string(), protocolVersion: z.number().int() }),
  z.object({ type: z.literal('subscribeCells'), cells: z.array(cellSchema) }),
  z.object({ type: z.literal('unsubscribeCells'), cells: z.array(cellSchema) }),
  z.object({ type: z.literal('command'), commandId: z.string(), command: commandPayloadSchema }),
  z.object({ type: z.literal('ping'), t0: z.number().int() }),
  z.object({ type: z.literal('watchEvents'), on: z.boolean() }),
]);

export const deltaSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('houseAppeared'), house: houseViewSchema }),
  z.object({ type: z.literal('houseChanged'), house: houseViewSchema }),
]);

export const serverFrameSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    serverTime: z.number().int(),
    playerId: z.string(),
    ownHouse: houseViewSchema.optional(),
  }),
  z.object({
    type: z.literal('snapshot'),
    cell: cellSchema,
    houses: z.array(houseViewSchema),
    asOfVersion: z.number().int(),
  }),
  z.object({ type: z.literal('batch'), deltas: z.array(deltaSchema) }),
  z.object({ type: z.literal('commandAccepted'), commandId: z.string() }),
  z.object({ type: z.literal('commandRejected'), commandId: z.string(), reason: z.string() }),
  z.object({ type: z.literal('resync'), cells: z.array(cellSchema) }),
  z.object({ type: z.literal('pong'), t0: z.number().int(), serverTime: z.number().int() }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
  z.object({
    type: z.literal('event'),
    id: z.string(),
    eventType: z.string(),
    stream: z.string(),
    streamVersion: z.number().int(),
    time: z.number().int(),
    data: z.record(z.string(), z.unknown()),
  }),
]);

export type Point = z.infer<typeof pointSchema>;
export type Tincture = z.infer<typeof tinctureSchema>;
export type Division = z.infer<typeof divisionSchema>;
export type Charge = z.infer<typeof chargeSchema>;
export type BannerSpec = z.infer<typeof bannerSchema>;
export type Rate = z.infer<typeof rateSchema>;
export type HouseView = z.infer<typeof houseViewSchema>;
export type CommandPayload = z.infer<typeof commandPayloadSchema>;
export type ClientFrame = z.infer<typeof clientFrameSchema>;
export type Delta = z.infer<typeof deltaSchema>;
export type ServerFrame = z.infer<typeof serverFrameSchema>;
/** One stored event as the panel shows it: the `event` frame on its own. */
export type EventFrame = Extract<ServerFrame, { type: 'event' }>;

/** The `type` names a discriminated union accepts, read off the schema so no test lists them by hand. */
export function frameTypesOf(union: {
  options: readonly { shape: { type: { value: unknown } } }[];
}): string[] {
  return union.options.map((option) => String(option.shape.type.value));
}
