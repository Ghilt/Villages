/**
 * The shapefile reader ships no types. Only the streaming reader is used, so only that is described here,
 * and only as much of it as this build touches.
 */
declare module 'shapefile' {
  interface ShapefileSource {
    read(): Promise<{ done: boolean; value: unknown }>;
  }
  export function open(shp: Uint8Array, dbf: Uint8Array): Promise<ShapefileSource>;
}
