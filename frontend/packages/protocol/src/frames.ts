import { z } from 'zod';
import {
  bannerSchema,
  holderViewSchema,
  cellSchema,
  pointSchema,
  resourceNameSchema,
  stockSchema,
  worldDaySchema,
} from './basics';
import {
  choiceViewSchema,
  nextRarityPayloadSchema,
  rollDrawnFrameSchema,
  rollPayloadSchema,
} from './choiceFrames';
import { dialogueViewSchema } from './dialogueFrames';
import {
  structureArrivedSchema,
  structureChangedSchema,
  structureViewSchema,
  yourHoldingsFrameSchema,
} from './structureFrames';
import { inspectAtFrameSchema, inspectedAtFrameSchema } from './placeFrames';

/**
 * The frames that cross the WebSocket, as zod schemas, so that a frame is checked at the edge and typed
 * inside. Mirrored in Kotlin under backend/protocol, and both sides are tested against the same fixtures in
 * contracts/fixtures/frames, which own the format.
 *
 * Times are the server's clock in milliseconds since the epoch. Optional fields are absent rather than
 * null. Heraldry is spelled the way the interface shows it.
 */

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
  /**
   * The world-day the fog hid it from the player's house, worked out by the gateway; absent while that house sees
   * it. What the tag beside a window's name says. See decision record 0089.
   */
  seenUntil: worldDaySchema.optional(),
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
  /** Where they stand on the map today. Absent while they are on none. */
  place: pointSchema.optional(),
  version: z.number().int(),
});

/**
 * A character standing on the map, as everyone holding the cell sees them: who and whose, how old and
 * where. Not their stats, which are their house's own. The age is counted here from `bornOn` and
 * `agedYears`, as a key figure's is. `cell` is the deepest cell the place falls in, as a house's is;
 * `since` the world-day they came to stand there; `version` the read model's revision; `seenUntil` as a house's,
 * and only on `inspected`, because a cell sends nobody its house does not see.
 */
export const characterOnMapViewSchema = z.object({
  id: z.string(),
  givenName: z.string(),
  familyName: z.string(),
  sex: sexSchema,
  species: speciesSchema,
  bornOn: worldDaySchema,
  agedYears: z.number().int(),
  portrait: z.string().optional(),
  place: pointSchema,
  cell: cellSchema,
  keyFigureOf: z.array(holderViewSchema),
  since: worldDaySchema,
  version: z.number().int(),
  seenUntil: worldDaySchema.optional(),
});

/**
 * Somewhere the player's house sees from. `kind` says what gives it and `of` is the key figure's id or the
 * given vision's, absent for the seat; `from` the structure a vision given is seen from. `radius` is how far it sees around `place`, in **kilometres** on the ground; how big that is
 * on the map is worked out at the place's latitude. `since` and `until` are world-days, and `until` is
 * absent while it still gives vision. See decision record 0061.
 */
export const visionPointViewSchema = z.object({
  kind: z.enum(['seat', 'keyFigure', 'given']),
  of: z.string().optional(),
  place: pointSchema,
  radius: z.number().positive(),
  since: worldDaySchema,
  until: worldDaySchema.optional(),
  from: z.string().optional(),
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
  /** Put a key figure somewhere on the map. The place and nothing else: how much it matters is the world's. */
  z.object({ type: z.literal('moveCharacter'), characterId: z.string(), place: pointSchema }),
  // Adam's levers for structures: one raised where the panel looks, and Antarctica's sixteen again. See
  // docs/plans/structures.md.
  z.object({
    type: z.literal('raiseStructure'),
    structureType: z.string(),
    level: z.number().int(),
    place: pointSchema,
    yours: z.boolean(),
  }),
  z.object({ type: z.literal('raiseAntarctica') }),
  z.object({ type: z.literal('takeControl'), structureId: z.string() }),
  z.object({ type: z.literal('takeOffTheMap'), characterId: z.string() }),
  /**
   * Give the house vision of a place outright, until it is taken away; how far it sees is the world's to say.
   * Take one away by the id `yourSight` names it under. Adam's levers. See decision record 0061.
   */
  z.object({ type: z.literal('giveVision'), place: pointSchema }),
  z.object({ type: z.literal('takeVision'), visionId: z.string() }),
  /**
   * A sample dialogue, by its name, spoken by the house's first key figure: the name and none of the words,
   * because a client that could write a dialogue could write itself a reward. Adam's lever. See 0071.
   */
  z.object({ type: z.literal('offerDialogue'), sample: z.string() }),
  /**
   * A step through one of the house's dialogues: the line that is the step, by its id within the dialogue - an
   * option of a dialogue choice, or the line the stretch read ends on. Whether it is the next step is the
   * house's to say, so the client names a line and nothing else. See decision record 0071.
   */
  z.object({ type: z.literal('completeDialogueStep'), dialogueId: z.string(), lineId: z.string() }),
  rollPayloadSchema,
  nextRarityPayloadSchema,
]);

export const clientFrameSchema = z.discriminatedUnion('type', [
  /**
   * Who is playing and which wire they speak, and the master the page draws, by its name, so the gateway sends
   * that world's stands. Absent, it sends none. See decision records 0025 and 0067.
   */
  z.object({
    type: z.literal('hello'),
    playerToken: z.string(),
    protocolVersion: z.number().int(),
    master: z.string().optional(),
  }),
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
  /**
   * Lift the fog of war for this connection, or let it fall again: lifted, the gateway sends what the house
   * cannot see as well. On until this says otherwise. Adam's switch and a debug frame, never a player's. See 0061.
   */
  z.object({ type: z.literal('fogOfWar'), on: z.boolean() }),
  /** Empty the development world, for everyone. A debug frame, never a player's. See 0036. */
  z.object({ type: z.literal('wipeWorld') }),
  inspectAtFrameSchema,
  /**
   * A window asking after its subject wherever the camera is, once, when it opens on something the page knows
   * nothing of. No subscription: it is answered once by `inspected`. See decision record 0088.
   */
  z.object({ type: z.literal('inspect'), kind: z.enum(['house', 'character', 'structure']), id: z.string() }),
]);

/**
 * A change in a held cell. A house never moves, so it only ever appears or changes; a character moves, so a
 * character can also be **gone** from every cell a connection holds, and the client drops them.
 */
export const deltaSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('houseAppeared'), house: houseViewSchema }),
  z.object({ type: z.literal('houseChanged'), house: houseViewSchema }),
  z.object({ type: z.literal('characterArrived'), character: characterOnMapViewSchema }),
  z.object({ type: z.literal('characterChanged'), character: characterOnMapViewSchema }),
  z.object({ type: z.literal('characterGone'), id: z.string(), version: z.number().int() }),
  structureArrivedSchema,
  structureChangedSchema,
]);

export const serverFrameSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    serverTime: z.number().int(),
    playerId: z.string(),
    /** Where the world's clock stands: today, and the earliest day anything is known to exist from. */
    world: z.object({ today: worldDaySchema, earliest: worldDaySchema }),
    /** Where the world is kept - in memory, or which database - said only while the instruments are open (0092). */
    keptIn: z.string().nullable().optional(),
  }),
  /** The player's own house and what only they can see of it. Null when they have none. */
  z.object({ type: z.literal('yourHouse'), yours: yourHouseViewSchema.nullable() }),
  /** What this player has to decide, or null when they have nothing. The parchment's one frame. */
  z.object({ type: z.literal('yourChoice'), choice: choiceViewSchema.nullable() }),
  /** The player's key figures in the order their house took them in, always a list. The pane's frame. */
  z.object({ type: z.literal('yourKeyFigures'), keyFigures: z.array(keyFigureViewSchema) }),
  yourHoldingsFrameSchema,
  /**
   * Every vision point the player's house has had, oldest first: its vision is the ones lasting today, what it
   * has revealed is everything any of them has covered, and the rest is unknown. Always a list, empty while
   * there is no house. The fog of war is drawn from this. See decision record 0061. `tension` is the surface
   * tension of the edge in kilometres, which joins circles close together: `coverageOf`, and 0064.
   */
  z.object({
    type: z.literal('yourSight'),
    points: z.array(visionPointViewSchema),
    tension: z.number().nonnegative(),
  }),
  /**
   * The player's dialogues, open and finished, in the order the house was offered them. Always a list, sent
   * after `yourSight` on hello and again whenever one changes, holding back what has not been reached. See 0071.
   */
  z.object({ type: z.literal('yourDialogues'), dialogues: z.array(dialogueViewSchema) }),
  /** Another window took this player over; this session is finished. */
  z.object({ type: z.literal('takenOver'), message: z.string() }),
  /** The world was emptied and this session is finished with it. Everyone is told. See 0036. */
  z.object({ type: z.literal('worldWiped'), message: z.string() }),
  /**
   * The scenery's stands in one zoom 7 tile, `x` across and `y` down, that touch ground the house has revealed:
   * the sprite map's own records, eight bytes a stand, in base64, which `decodeStands` reads. Sent for every tile
   * under a held cell from zoom 6 in, and again when the house's sight or the fog switch changes what it lets
   * through; empty when nothing there does. What the fog holds back is left out. See decision record 0067.
   */
  z.object({ type: z.literal('stands'), x: z.number().int(), y: z.number().int(), stands: z.base64() }),
  z.object({
    type: z.literal('snapshot'),
    cell: cellSchema,
    houses: z.array(houseViewSchema),
    asOfVersion: z.number().int(),
    /** How many more the cell held than the snapshot carries. Absent means none. */
    omitted: z.number().int().nonnegative().optional(),
    /** The characters standing in the cell. Absent means nobody. */
    characters: z.array(characterOnMapViewSchema).optional(),
    /** How many more characters stood there than the snapshot carries. Absent means none. */
    omittedCharacters: z.number().int().nonnegative().optional(),
    /** The structures standing in the cell, each in the face the house is sent. Absent means none. */
    structures: z.array(structureViewSchema).optional(),
    omittedStructures: z.number().int().nonnegative().optional(),
    /** The structures' read model's count of changes when this was read; a copy stamped no later is replaced. */
    structuresAsOf: z.number().int().optional(),
  }),
  z.object({ type: z.literal('batch'), deltas: z.array(deltaSchema) }),
  z.object({ type: z.literal('commandAccepted'), commandId: z.string() }),
  z.object({ type: z.literal('commandRejected'), commandId: z.string(), reason: z.string() }),
  z.object({ type: z.literal('resync'), cells: z.array(cellSchema) }),
  z.object({ type: z.literal('pong'), t0: z.number().int(), serverTime: z.number().int() }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
  rollDrawnFrameSchema,
  inspectedAtFrameSchema,
  /**
   * The answer to `inspect`, once: the house, the character or the structure as the map would show it, or none when
   * there is no such thing or the fog holds it back, by the rule a cell's snapshot is held to. Somebody seen once and not now
   * is answered as last seen; either carries the day the fog hid it as `seenUntil`, on its view. See 0088, 0089.
   */
  z.object({
    type: z.literal('inspected'),
    kind: z.string(),
    id: z.string(),
    house: houseViewSchema.optional(),
    character: characterOnMapViewSchema.optional(),
    structure: structureViewSchema.optional(),
  }),
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

export type PledgeView = z.infer<typeof pledgeViewSchema>;
export type YourHouseView = z.infer<typeof yourHouseViewSchema>;
export type HouseView = z.infer<typeof houseViewSchema>;
export type StatName = z.infer<typeof statNameSchema>;
export type Sex = z.infer<typeof sexSchema>;
export type HolderView = z.infer<typeof holderViewSchema>;
export type KeyFigureView = z.infer<typeof keyFigureViewSchema>;
export type CharacterOnMapView = z.infer<typeof characterOnMapViewSchema>;
export type VisionPointView = z.infer<typeof visionPointViewSchema>;
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

export { holderViewSchema };
