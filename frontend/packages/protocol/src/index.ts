/**
 * What the gateway and the browser must agree on: the frames that cross between them, and the grid the
 * world is partitioned by. The fixtures in `contracts/fixtures` own both; this package and the Kotlin
 * `protocol` module are held to the same ones.
 */

/** Sent on the handshake so that the gateway can refuse a client it cannot speak to. */
export const PROTOCOL_VERSION = 51;

export {
  MAX_ZOOM,
  MERCATOR_EDGE,
  cellAt,
  cellAtZoom,
  cellsForView,
  coarsestZoom,
  isInside,
  quadkeyOf,
  tileAt,
} from './cells';
export type { Tile, View } from './cells';

export { EQUATOR_KM, mercatorX, mercatorY, reachAcross, reaches } from './reach';
export { coverageOf } from './coverage';
export type { Coverage, CoverageCircle } from './coverage';
export { STANDS_FROM_ZOOM, STAND_TILES, STAND_TILE_MARGIN, standTilesUnder } from './standTiles';

export {
  MONTHS,
  dateOf,
  dayOf,
  dayOfMonthOf,
  daysInMonth,
  describeDay,
  shortDay,
  isLeapYear,
  monthOf,
  monthsBetween,
  plusMonths,
  yearOf,
} from './calendar';
export type { WorldDate } from './calendar';

export {
  characterOnMapViewSchema,
  clientFrameSchema,
  commandPayloadSchema,
  deltaSchema,
  frameTypesOf,
  holderViewSchema,
  houseViewSchema,
  keyFigureViewSchema,
  pledgeViewSchema,
  serverFrameSchema,
  sexSchema,
  speciesSchema,
  statNameSchema,
  visionPointViewSchema,
  yourHouseViewSchema,
} from './frames';
export {
  bannerSchema,
  cellSchema,
  chargeSchema,
  divisionSchema,
  pointSchema,
  resourceNameSchema,
  stockSchema,
  tinctureSchema,
  worldDaySchema,
} from './basics';
export {
  choiceViewSchema,
  effectViewSchema,
  nextRarityPayloadSchema,
  omenKindSchema,
  omenViewSchema,
  optionViewSchema,
  raritySchema,
  rollDrawnFrameSchema,
  rollPayloadSchema,
} from './choiceFrames';
export type {
  CharacterOnMapView,
  ClientFrame,
  CommandPayload,
  Delta,
  EventFrame,
  HolderView,
  HouseView,
  KeyFigureView,
  PledgeView,
  ServerFrame,
  Sex,
  StatName,
  VisionPointView,
  YourHouseView,
} from './frames';
export type { BannerSpec, Charge, Division, Point, ResourceName, Stock, Tincture } from './basics';
export type { ChoiceView, EffectView, OmenView, OptionView, Rarity, RollDrawnFrame } from './choiceFrames';
export { inspectAtFrameSchema, inspectedAtFrameSchema, waterViewSchema } from './placeFrames';
export type { InspectedAtFrame, WaterKind, WaterView } from './placeFrames';
export type {
  DialogueView,
  EndingView,
  ImpactView,
  LineView,
  RequirementView,
  RevealImpactView,
  SaidLineView,
  ShowsView,
  SpeakerView,
} from './dialogueFrames';
export type { ObjectiveView, QuestEdgeView, QuestNodeState, QuestNodeView, QuestView } from './questFrames';
export {
  structureArrivedSchema,
  structureChangedSchema,
  structureViewSchema,
  yourHoldingsFrameSchema,
} from './structureFrames';
export type { ContentView, SlotView, StructureView } from './structureFrames';
