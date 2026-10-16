/**
 * Every number of the trees in the wind, for Adam's eye: how far a gust bends the scenery, how much a crown pales
 * as it passes, and what each kind of scenery does of that. Colours are red, green and blue from nought to one.
 */
export const TREES_LOOK = {
  /**
   * What low and high are for the trees, the levels in the Shaders section: how often they move. They are drawn
   * with the sprite canvas at its own size, so a level is only its frames; a frame is the whole canvas drawn
   * again. High is at every load.
   */
  levels: {
    low: { resolution: 1, framesPerSecond: 15 },
    high: { resolution: 1, framesPerSecond: 30 },
  },
  /**
   * How far the top of the bendiest kind moves down the wind in a whole gust, as a share of its height; the Trees
   * part's first slider. Every other kind bends its own share of that.
   */
  bend: 0.14,
  /** How far the palest crown turns to its paler side in a whole gust, nought to one; the second slider. */
  pale: 0.22,
  /** The paler side a crown shows as a gust turns its leaves. */
  sheen: [0.86, 0.9, 0.76],
  /**
   * How far a tree sways with no gust at all, as a share of how far a whole gust bends it, and how fast, in turns
   * a second: a quarter, which comes round with the wall clock's hour (`../wind.ts`).
   */
  idle: 0.15,
  idleSpeed: 0.25,
  /**
   * How far a shadow falls from its foot, as a share of its sprite's height: a third, to the left, as the shadows
   * are cut for the one light (`map/light.ts`). Its far end leans as the top of its sprite does.
   */
  shadowReach: 1 / 3,
  /**
   * Each kind of scenery by its name in `world/biomes.json`: how far it bends, as a share of the bendiest, and how
   * much its crown pales, as a share of the palest, nought to one each. A stone or a cactus does neither. A kind
   * this does not name stands still, as a mountain will.
   */
  kinds: {
    pine: { bend: 0.45, pale: 0.2 },
    spruce: { bend: 0.35, pale: 0.15 },
    birch: { bend: 1, pale: 0.9 },
    oak: { bend: 0.35, pale: 0.55 },
    beech: { bend: 0.45, pale: 0.6 },
    palm: { bend: 0.9, pale: 0.5 },
    jungle: { bend: 0.3, pale: 0.45 },
    acacia: { bend: 0.35, pale: 0.3 },
    mangrove: { bend: 0.25, pale: 0.35 },
    snag: { bend: 0.08, pale: 0 },
    scrub: { bend: 0.45, pale: 0.35 },
    heather: { bend: 0.55, pale: 0.25 },
    grass: { bend: 1, pale: 0.7 },
    reed: { bend: 1, pale: 0.6 },
    boulder: { bend: 0, pale: 0 },
    cactus: { bend: 0, pale: 0 },
  } as Record<string, { bend: number; pale: number } | undefined>,
} as const;

const byte = (share: number): number => Math.round(Math.min(1, Math.max(0, share)) * 255);

/**
 * The tint a kind's sprites carry, which is how the scenery's shader knows what each does in the wind: its red is
 * how far it bends, its green how much its crown pales. The pictures carry their own colour and are never tinted
 * (`LOOK-AND-FEEL.md`), so the shader takes nothing else from the tint but the fade in its alpha.
 */
export function tintOf(kind: string): number {
  const own = TREES_LOOK.kinds[kind] ?? { bend: 0, pale: 0 };
  return (byte(own.bend) << 16) | (byte(own.pale) << 8) | 0xff;
}
