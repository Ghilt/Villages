import type { MapSprite } from './SpriteRenderer';

/**
 * Stand-ins for houses, so that the overlay can be seen and judged before there is a world to read them
 * from. They are real places, spread widely enough that panning and zooming shows the pinning working.
 *
 * This file goes away in increment 1.10, when houses arrive from the gateway.
 */
export const DEMO_SEATS: readonly MapSprite[] = [
  { id: 'seat-visby', at: { lng: 18.2948, lat: 57.6348 }, tint: 0xb03a2e },
  { id: 'seat-stockholm', at: { lng: 18.0686, lat: 59.3293 }, tint: 0x1f4e79 },
  { id: 'seat-copenhagen', at: { lng: 12.5683, lat: 55.6761 }, tint: 0xd4a017 },
  { id: 'seat-bergen', at: { lng: 5.3221, lat: 60.3913 }, tint: 0x2e6b4f },
  { id: 'seat-edinburgh', at: { lng: -3.1883, lat: 55.9533 }, tint: 0x5b3a86 },
  { id: 'seat-bruges', at: { lng: 3.2247, lat: 51.2093 }, tint: 0x8a6d3b },
  { id: 'seat-krakow', at: { lng: 19.945, lat: 50.0647 }, tint: 0x9c3d54 },
  { id: 'seat-riga', at: { lng: 24.1052, lat: 56.9496 }, tint: 0x3f6f8f },
];
