/**
 * What the gateway and the browser must agree on: the frames that cross between them, and the grid the
 * world is partitioned by. The fixtures in `contracts/fixtures` own both; this package and the Kotlin
 * `protocol` module are held to the same ones.
 */

/** Sent on the handshake so that the gateway can refuse a client it cannot speak to. */
export const PROTOCOL_VERSION = 1;

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

export { DAYS_PER_YEAR, dayOf, dayOfYearOf, describeDay, yearOf } from './calendar';

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
  houseViewSchema,
  pointSchema,
  rateSchema,
  serverFrameSchema,
  tinctureSchema,
} from './frames';
export type {
  BannerSpec,
  Charge,
  ChoiceView,
  ClientFrame,
  CommandPayload,
  Delta,
  Division,
  EffectView,
  EventFrame,
  HouseView,
  OptionView,
  Point,
  Rate,
  ServerFrame,
  Tincture,
} from './frames';
