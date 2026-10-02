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
  /** Where they stand on the map today. Absent while they are on none. */
  place: pointSchema.optional(),
  version: z.number().int(),
});

/**
 * A character standing on the map, as everyone holding the cell sees them: who and whose, how old and
 * where. Not their stats, which are their house's own. The age is counted here from `bornOn` and
 * `agedYears`, as a key figure's is. `cell` is the deepest cell the place falls in, as a house's is;
 * `since` the world-day they came to stand there; `version` the read model's revision.
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
});

/**
 * Somewhere the player's house sees from. `kind` says what gives it and `of` is the key figure's id or the
 * given vision's, absent for the seat. `radius` is how far it sees around `place`, in **kilometres** on the ground; how big that is
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
});

/**
 * What taking an option would do. `kind` names the case, as it does in the store. See 0034. A `grant` is
 * some of a resource given, and a `spend` some taken: what an option can cost, in a choice or a dialogue. See 0071.
 */
export const effectViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('foundAt'), seat: pointSchema, name: z.string(), banner: bannerSchema }),
  z.object({ kind: z.literal('grant'), resource: resourceNameSchema, amount: z.number().int().positive() }),
  z.object({ kind: z.literal('spend'), resource: resourceNameSchema, amount: z.number().int().positive() }),
]);

export const optionViewSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string(),
  effect: effectViewSchema,
});

/** Something a dialogue needs to stay true. `kind` names the case: `alive`, a character by id. See 0071. */
export const requirementViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('alive'), character: z.string() }),
]);

/** How a dialogue stands: open, finished, or lost because one of its requirements failed. */
export const endingViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('open') }),
  z.object({ kind: z.literal('completed') }),
  z.object({ kind: z.literal('lost'), because: requirementViewSchema }),
]);

/** Who speaks in a dialogue: the party says which side, and nothing about a screen. */
export const speakerViewSchema = z.object({
  id: z.string(),
  party: z.number().int(),
  name: z.string(),
  portrait: z.string().optional(),
  character: z.string().optional(),
});

/** Some of one resource, gained or, below nothing, lost. */
export const impactViewSchema = z.object({ resource: resourceNameSchema, amount: z.number().int() });

/**
 * How an option shows what taking it will do, as whoever wrote it chose: `shown`, with what, or `hidden`,
 * drawn as unknown. An option without one shows nothing until it is done. See decision record 0071.
 */
export const revealImpactViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('shown'), impacts: z.array(impactViewSchema).min(1) }),
  z.object({ kind: z.literal('hidden') }),
]);

/**
 * A line still to be read, or an option to pick: who says it and the words, and nothing about what it will do
 * but, on an option, its reveal impact.
 */
export const lineViewSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  words: z.string(),
  revealImpact: revealImpactViewSchema.optional(),
});

/** A line said, with what saying it did to the house: what it gave, and what it took. */
export const saidLineViewSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  words: z.string(),
  effects: z.array(effectViewSchema),
});

/**
 * One dialogue as the player may know it. `revision` rises with every change to it. `next` ends in the step
 * to send when there are no `options`, and in the line the dialogue choice follows when there are. Nothing
 * past it is ever sent, and no requirement: a player learns of one only when it fails. See decision record 0071.
 */
export const dialogueViewSchema = z.object({
  id: z.string(),
  revision: z.number().int(),
  title: z.string(),
  scene: z.string().optional(),
  speakers: z.array(speakerViewSchema),
  said: z.array(saidLineViewSchema),
  next: z.array(lineViewSchema),
  options: z.array(lineViewSchema),
  ending: endingViewSchema,
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
  /** Put a key figure somewhere on the map. The place and nothing else: how much it matters is the world's. */
  z.object({ type: z.literal('moveCharacter'), characterId: z.string(), place: pointSchema }),
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
export type RequirementView = z.infer<typeof requirementViewSchema>;
export type EndingView = z.infer<typeof endingViewSchema>;
export type SpeakerView = z.infer<typeof speakerViewSchema>;
export type ImpactView = z.infer<typeof impactViewSchema>;
export type RevealImpactView = z.infer<typeof revealImpactViewSchema>;
export type LineView = z.infer<typeof lineViewSchema>;
export type SaidLineView = z.infer<typeof saidLineViewSchema>;
export type DialogueView = z.infer<typeof dialogueViewSchema>;
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
