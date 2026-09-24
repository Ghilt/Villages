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

/** One live pledge: what is tied up, how much, until when, and what for. */
export const pledgeViewSchema = z.object({
  id: z.string(),
  resource: resourceNameSchema,
  amount: z.number().int(),
  until: worldDaySchema,
  purpose: z.string(),
});

export const houseViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  cell: cellSchema,
  seat: pointSchema,
  banner: bannerSchema,
  /** The world-day it exists from. */
  since: worldDaySchema,
  version: z.number().int(),
});

/**
 * The player's own house: everything anybody can see of it, and what only its owner can.
 *
 * **What a house has is private.** A `houseView` goes to everyone holding the cell, up to two hundred at
 * a time, so putting five stocks on it would tell the neighbours a house's business and multiply what a
 * snapshot weighs. Resources reach one session, and the shape is what enforces that rather than a
 * convention somebody has to remember.
 */
export const yourHouseViewSchema = z.object({
  house: houseViewSchema,
  resources: z.record(resourceNameSchema, stockSchema),
  pledges: z.array(pledgeViewSchema),
});

/** A character's four stats by the wire's names. Piety and reason are the resources' words on purpose. */
export const statNameSchema = z.enum(['piety', 'reason', 'kindness', 'physical']);
export const sexSchema = z.enum(['woman', 'man']);
export const speciesSchema = z.enum(['person']);

/** A stat is a whole number from one to twenty. */
const statSchema = z.number().int().min(1).max(20);

/** A house holding a character as a key figure, named the way a view of the tie needs it. */
export const holderViewSchema = z.object({ id: z.string(), name: z.string(), banner: bannerSchema });

/**
 * One of the player's key figures, as the pane shows them. Their age is not on the wire: it is the completed
 * months from `bornOn` to today, over twelve, plus `agedYears`, worked out here with the calendar. The stats
 * are on the owner's view and nobody else's. `version` is the read model's revision. See decision 0055.
 */
export const keyFigureViewSchema = z.object({
  id: z.string(),
  givenName: z.string(),
  familyName: z.string(),
  sex: sexSchema,
  species: speciesSchema,
  bornOn: worldDaySchema,
  agedYears: z.number().int(),
  stats: z.object({ piety: statSchema, reason: statSchema, kindness: statSchema, physical: statSchema }),
  /** The portrait's key, its file's name in `world/portraits/` without the `.png`. Absent means none. */
  portrait: z.string().optional(),
  /** Every house holding them, in the order they were taken in: the first is whose colours they wear. */
  keyFigureOf: z.array(holderViewSchema),
  version: z.number().int(),
});

/** What taking an option would do. `kind` names the case, as it does in the store. See 0034. */
export const effectViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('foundAt'), seat: pointSchema, name: z.string(), banner: bannerSchema }),
]);

export const optionViewSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string(),
  effect: effectViewSchema,
});

/**
 * A choice as the parchment shows it. The interface renders this and nothing else, so a new kind of
 * choice needs no new frame and no new component. See decision record 0034.
 */
export const choiceViewSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(optionViewSchema),
});

export const commandPayloadSchema = z.discriminatedUnion('type', [
  /**
   * Give this house some of a resource, or use some of it up.
   *
   * Adam's levers rather than a player's: nothing in the game grants or spends anything yet, and these
   * exist so that what the domain can do can be made to happen on purpose and watched. A mechanic that
   * grants or spends later will go through these same commands.
   */
  z.object({ type: z.literal('grantResource'), resource: resourceNameSchema, amount: z.number().int() }),
  z.object({ type: z.literal('spendResource'), resource: resourceNameSchema, amount: z.number().int() }),
  /** The span is in months; which world-day that lands on is the server's to work out. See 0053. */
  z.object({
    type: z.literal('pledgeResource'),
    resource: resourceNameSchema,
    amount: z.number().int(),
    months: z.number().int(),
    purpose: z.string(),
  }),
  z.object({ type: z.literal('releasePledge'), pledgeId: z.string() }),
  /** No house id: the server works it out from the player, so a client cannot name a stream. See 0028. */
  z.object({
    type: z.literal('foundHouse'),
    name: z.string(),
    seat: pointSchema,
    banner: bannerSchema,
  }),
  /** Which story this continues is not on the wire: the server reads it from the choice. See 0035. */
  z.object({
    type: z.literal('takeAction'),
    choiceId: z.string(),
    optionId: z.string(),
  }),
  /** Bring a newcomer in as a key figure: rolled by the server, named by nobody. Adam's lever. See 0055. */
  z.object({ type: z.literal('addKeyFigure') }),
  /**
   * The levers on one of the player's key figures. The server asks the player's own house first, and anybody
   * who is not one of its key figures is refused `noSuchKeyFigure`. `by` and `years` may be negative.
   */
  z.object({
    type: z.literal('changeStat'),
    characterId: z.string(),
    stat: statNameSchema,
    by: z.number().int(),
  }),
  z.object({ type: z.literal('ageCharacter'), characterId: z.string(), years: z.number().int() }),
  /** Another portrait by its key, or none when `portrait` is absent. */
  z.object({ type: z.literal('changePortrait'), characterId: z.string(), portrait: z.string().optional() }),
  z.object({ type: z.literal('killCharacter'), characterId: z.string(), cause: z.string() }),
]);

export const clientFrameSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), playerToken: z.string(), protocolVersion: z.number().int() }),
  z.object({ type: z.literal('subscribeCells'), cells: z.array(cellSchema) }),
  z.object({ type: z.literal('unsubscribeCells'), cells: z.array(cellSchema) }),
  /** The command id is a UUID: it becomes the causation id of every event the command writes. See 0035. */
  z.object({ type: z.literal('command'), commandId: z.uuid(), command: commandPayloadSchema }),
  z.object({ type: z.literal('ping'), t0: z.number().int() }),
  z.object({ type: z.literal('watchEvents'), on: z.boolean() }),
  /** Look at the world as it was on a day, or at live when null. The timeline scrubber's one frame. */
  z.object({ type: z.literal('viewTime'), at: worldDaySchema.nullable() }),
  /** Set significance aside: every house in a held cell, however far back the camera is. See 0038. */
  z.object({ type: z.literal('seeAll'), on: z.boolean() }),
  /** Empty the development world, for everyone. A debug frame, never a player's. See 0036. */
  z.object({ type: z.literal('wipeWorld') }),
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
    /** Where the world's clock stands: today, and the earliest day anything is known to exist from. */
    world: z.object({ today: worldDaySchema, earliest: worldDaySchema }),
  }),
  /** The player's own house and what only they can see of it. Null when they have none. */
  z.object({ type: z.literal('yourHouse'), yours: yourHouseViewSchema.nullable() }),
  /** What this player has to decide, or null when they have nothing. The parchment's one frame. */
  z.object({ type: z.literal('yourChoice'), choice: choiceViewSchema.nullable() }),
  /** The player's key figures in the order their house took them in, always a list. The pane's frame. */
  z.object({ type: z.literal('yourKeyFigures'), keyFigures: z.array(keyFigureViewSchema) }),
  /** Another window took this player over; this session is finished. */
  z.object({ type: z.literal('takenOver'), message: z.string() }),
  /** The world was emptied and this session is finished with it. Everyone is told. See 0036. */
  z.object({ type: z.literal('worldWiped'), message: z.string() }),
  z.object({
    type: z.literal('snapshot'),
    cell: cellSchema,
    houses: z.array(houseViewSchema),
    asOfVersion: z.number().int(),
    /** How many more the cell held than the snapshot carries. Absent means none. */
    omitted: z.number().int().nonnegative().optional(),
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
    /** The story this event belongs to, and what directly caused it. See decision record 0035. */
    correlationId: z.string(),
    causationId: z.string(),
    data: z.record(z.string(), z.unknown()),
  }),
]);

export type Point = z.infer<typeof pointSchema>;
export type Tincture = z.infer<typeof tinctureSchema>;
export type Division = z.infer<typeof divisionSchema>;
export type Charge = z.infer<typeof chargeSchema>;
export type BannerSpec = z.infer<typeof bannerSchema>;
export type Stock = z.infer<typeof stockSchema>;
export type ResourceName = z.infer<typeof resourceNameSchema>;
export type PledgeView = z.infer<typeof pledgeViewSchema>;
export type YourHouseView = z.infer<typeof yourHouseViewSchema>;
export type HouseView = z.infer<typeof houseViewSchema>;
export type EffectView = z.infer<typeof effectViewSchema>;
export type OptionView = z.infer<typeof optionViewSchema>;
export type ChoiceView = z.infer<typeof choiceViewSchema>;
export type StatName = z.infer<typeof statNameSchema>;
export type Sex = z.infer<typeof sexSchema>;
export type HolderView = z.infer<typeof holderViewSchema>;
export type KeyFigureView = z.infer<typeof keyFigureViewSchema>;
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
