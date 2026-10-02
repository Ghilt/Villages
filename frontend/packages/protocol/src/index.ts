/**
 * What the gateway and the browser must agree on: the frames that cross between them, and the grid the
 * world is partitioned by. The fixtures in `contracts/fixtures` own both; this package and the Kotlin
 * `protocol` module are held to the same ones.
 */

/** Sent on the handshake so that the gateway can refuse a client it cannot speak to. */
export const PROTOCOL_VERSION = 20;

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
  isLeapYear,
  monthOf,
  monthsBetween,
  plusMonths,
  yearOf,
} from './calendar';
export type { WorldDate } from './calendar';

export {
  bannerSchema,
  cellSchema,
  worldDaySchema,
  chargeSchema,
  choiceViewSchema,
  clientFrameSchema,
  commandPayloadSchema,
  effectViewSchema,
  optionViewSchema,
  deltaSchema,
  divisionSchema,
  frameTypesOf,
  characterOnMapViewSchema,
  holderViewSchema,
  houseViewSchema,
  keyFigureViewSchema,
  pointSchema,
  pledgeViewSchema,
  resourceNameSchema,
  sexSchema,
  speciesSchema,
  statNameSchema,
  stockSchema,
  yourHouseViewSchema,
  serverFrameSchema,
  tinctureSchema,
  visionPointViewSchema,
} from './frames';
export type {
  BannerSpec,
  CharacterOnMapView,
  Charge,
  ChoiceView,
  ClientFrame,
  CommandPayload,
  DialogueView,
  Delta,
  Division,
  EffectView,
  EndingView,
  EventFrame,
  HolderView,
  HouseView,
  ImpactView,
  KeyFigureView,
  LineView,
  OptionView,
  Point,
  PledgeView,
  RequirementView,
  RevealImpactView,
  ResourceName,
  SaidLineView,
  Sex,
  SpeakerView,
  StatName,
  Stock,
  YourHouseView,
  ServerFrame,
  Tincture,
  VisionPointView,
} from './frames';
