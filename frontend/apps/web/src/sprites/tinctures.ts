import type { Tincture } from '@villages/protocol';

/**
 * The heraldic tinctures as the map draws them. Muted rather than saturated, because they sit on a
 * painted map and a pure red on parchment reads as an error, not a banner. The full banner, with its
 * division and charge, arrives with increment 1.12; until then a house is a mark in its field's tincture.
 */
const COLOURS: Record<Tincture, number> = {
  or: 0xd4a017,
  argent: 0xe8e4d8,
  gules: 0xb03a2e,
  azure: 0x1f4e79,
  sable: 0x2b2b2b,
  vert: 0x2e6b4f,
  purpure: 0x5b3a86,
};

export function tinctureColour(tincture: Tincture): number {
  return COLOURS[tincture];
}
