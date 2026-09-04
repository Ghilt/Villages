/**
 * The wire format between the gateway and the browser: zod schemas for every frame, and the types inferred
 * from them. The fixtures in `contracts/fixtures` own the format; this package and the Kotlin `protocol`
 * module are both tested against them.
 */

/** Sent on the handshake so that the gateway can refuse a client it cannot speak to. */
export const PROTOCOL_VERSION = 1;

export {
  bannerSchema,
  cellSchema,
  chargeSchema,
  clientFrameSchema,
  commandPayloadSchema,
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
  ClientFrame,
  CommandPayload,
  Delta,
  Division,
  HouseView,
  Point,
  Rate,
  ServerFrame,
  Tincture,
} from './frames';
