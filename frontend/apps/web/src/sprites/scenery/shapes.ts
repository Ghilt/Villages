import { Graphics } from 'pixi.js';

/**
 * What each kind of scenery is drawn as.
 *
 * Drawn in code rather than authored as art, for the reason the castle experiment found: there is no
 * SVG rasteriser on this machine, and a shape in code is a shape a test can make without a file. They
 * are baked once into one atlas and every one of them is then a particle, so the cost of a kind is a
 * slot in a texture and nothing per frame.
 *
 * **Every one is a silhouette.** A world unit is about 1.2 kilometres, so a pine of one and a half
 * units stands for a couple of kilometres of forest and is about twenty pixels tall at the closest the
 * camera comes. At twenty pixels the only thing that reads is the outline: what tells a spruce from an
 * oak is that one is a spike and the other is a ball, and no amount of detail inside either survives.
 * So each is filled white, tinted at runtime by the fade, and outlined in a dark green that carries the
 * shape against the paint.
 *
 * They are ordered by nothing. The sprite map's `kinds` decides the order in the atlas, and a kind with
 * no shape here falls back to the bush, which is the least wrong thing to be.
 */

/** The outline every kind is drawn with, so the whole carpet reads as one hand. */
const LINE = { width: 3, color: 0x3d4a33, alpha: 0.85 } as const;
/** A lighter one for the small things, whose outline would otherwise eat the shape. */
const FINE = { width: 2.4, color: 0x4a5237, alpha: 0.85 } as const;
const TRUNK = 0x6b5a44;

type Draw = (w: number, h: number) => Graphics;

/** A conifer of a given waist: three tiers of needles over a short trunk. */
const conifer =
  (waist: number, tiers: number): Draw =>
  (w, h) => {
    const shape = new Graphics()
      .rect(w * 0.45, h * 0.8, w * 0.1, h * 0.2)
      .fill(TRUNK)
      .moveTo(w * 0.5, 0);
    const right: [number, number][] = [];
    const left: [number, number][] = [];
    for (let tier = 1; tier <= tiers; tier += 1) {
      const down = (tier / tiers) * 0.82;
      const out = waist * (tier / tiers);
      right.push([w * (0.5 + out), h * down], [w * (0.5 + out * 0.66), h * down]);
      left.unshift([w * (0.5 - out * 0.66), h * down], [w * (0.5 - out), h * down]);
    }
    // The last tier is the skirt, so the tree sits on the ground rather than hovering over it.
    right[right.length - 1] = [w * (0.5 + waist), h * 0.82];
    left[0] = [w * (0.5 - waist), h * 0.82];
    for (const [x, y] of [...right, ...left]) {
      shape.lineTo(x, y);
    }
    return shape.closePath().fill(0xffffff).stroke(LINE);
  };

/** A broadleaf: a crown on a trunk, as wide or as tall as the kind wants to be. */
const broadleaf =
  (wide: number, tall: number, crownAt: number): Draw =>
  (w, h) =>
    new Graphics()
      .rect(w * 0.46, h * (crownAt + tall * 0.55), w * 0.08, h * (1 - crownAt - tall * 0.55))
      .fill(TRUNK)
      .ellipse(w * 0.5, h * crownAt, w * wide, h * tall)
      .fill(0xffffff)
      .stroke(LINE);

const SHAPES: Record<string, Draw> = {
  pine: conifer(0.36, 3),
  spruce: conifer(0.26, 4),

  birch: (w, h) =>
    new Graphics()
      .rect(w * 0.47, h * 0.5, w * 0.06, h * 0.5)
      .fill(TRUNK)
      .ellipse(w * 0.5, h * 0.3, w * 0.24, h * 0.3)
      .fill(0xffffff)
      .stroke(FINE),

  oak: broadleaf(0.42, 0.36, 0.4),
  beech: broadleaf(0.33, 0.42, 0.36),

  // A palm: a bent stem and five fronds, which is the one silhouette nothing else can be mistaken for.
  palm: (w, h) => {
    const shape = new Graphics()
      .moveTo(w * 0.46, h)
      .quadraticCurveTo(w * 0.52, h * 0.6, w * 0.6, h * 0.3)
      .lineTo(w * 0.66, h * 0.32)
      .quadraticCurveTo(w * 0.58, h * 0.62, w * 0.54, h)
      .closePath()
      .fill(TRUNK);
    for (const [toX, toY] of [
      [0.06, 0.34],
      [0.2, 0.06],
      [0.62, 0.0],
      [0.94, 0.18],
      [0.98, 0.46],
    ] as const) {
      shape
        .moveTo(w * 0.62, h * 0.3)
        .quadraticCurveTo(w * ((0.62 + toX) / 2), h * (toY - 0.12), w * toX, h * toY)
        .quadraticCurveTo(w * ((0.62 + toX) / 2), h * (toY + 0.1), w * 0.62, h * 0.34)
        .closePath();
    }
    return shape.fill(0xffffff).stroke(FINE);
  },

  // A jungle crown: the tallest thing in the file, a heavy dome that crowds its neighbours out.
  jungle: (w, h) =>
    new Graphics()
      .rect(w * 0.45, h * 0.62, w * 0.1, h * 0.38)
      .fill(TRUNK)
      .moveTo(w * 0.04, h * 0.5)
      .quadraticCurveTo(w * 0.1, h * 0.12, w * 0.34, h * 0.1)
      .quadraticCurveTo(w * 0.5, h * -0.04, w * 0.68, h * 0.1)
      .quadraticCurveTo(w * 0.92, h * 0.14, w * 0.96, h * 0.5)
      .quadraticCurveTo(w * 0.5, h * 0.66, w * 0.04, h * 0.5)
      .closePath()
      .fill(0xffffff)
      .stroke(LINE),

  // An acacia: a flat umbrella on a bare stem. Savanna reads as this shape and nothing else.
  acacia: (w, h) =>
    new Graphics()
      .moveTo(w * 0.46, h)
      .lineTo(w * 0.48, h * 0.45)
      .lineTo(w * 0.54, h * 0.45)
      .lineTo(w * 0.56, h)
      .closePath()
      .fill(TRUNK)
      .moveTo(w * 0.04, h * 0.4)
      .quadraticCurveTo(w * 0.5, h * 0.04, w * 0.96, h * 0.4)
      .quadraticCurveTo(w * 0.5, h * 0.3, w * 0.04, h * 0.4)
      .closePath()
      .fill(0xffffff)
      .stroke(LINE),

  // A mangrove: a low crown standing on splayed prop roots, out of the water.
  mangrove: (w, h) => {
    const shape = new Graphics();
    for (const foot of [0.08, 0.28, 0.5, 0.72, 0.92]) {
      shape
        .moveTo(w * foot, h)
        .quadraticCurveTo(w * ((foot + 0.5) / 2), h * 0.82, w * 0.5, h * 0.56)
        .lineTo(w * 0.5, h * 0.66)
        .quadraticCurveTo(w * ((foot + 0.5) / 2), h * 0.9, w * (foot + 0.06), h)
        .closePath();
    }
    return shape
      .fill(TRUNK)
      .ellipse(w * 0.5, h * 0.36, w * 0.4, h * 0.3)
      .fill(0xffffff)
      .stroke(LINE);
  },

  // A snag: a dead tree, two broken limbs, no crown. One in a screenful is a story.
  snag: (w, h) =>
    new Graphics()
      .moveTo(w * 0.44, h)
      .lineTo(w * 0.44, h * 0.2)
      .lineTo(w * 0.3, h * 0.06)
      .lineTo(w * 0.5, h * 0.14)
      .lineTo(w * 0.5, h * 0.4)
      .lineTo(w * 0.78, h * 0.22)
      .lineTo(w * 0.56, h * 0.52)
      .lineTo(w * 0.56, h)
      .closePath()
      .fill(0xffffff)
      .stroke(LINE),

  // A bush: three lobes, low and woody. Also the fallback, because it is the least wrong thing to be.
  scrub: (w, h) =>
    new Graphics()
      .ellipse(w * 0.3, h * 0.66, w * 0.28, h * 0.3)
      .ellipse(w * 0.7, h * 0.66, w * 0.26, h * 0.28)
      .ellipse(w * 0.5, h * 0.44, w * 0.32, h * 0.34)
      .fill(0xffffff)
      .stroke(FINE),

  // Heather: a low mat, wider than it is tall, with a broken top edge.
  heather: (w, h) => {
    const shape = new Graphics().moveTo(w * 0.02, h);
    for (let at = 0; at <= 6; at += 1) {
      const x = 0.02 + (at / 6) * 0.96;
      shape.lineTo(w * x, h * (at % 2 === 0 ? 0.34 : 0.16));
    }
    return shape
      .lineTo(w * 0.98, h)
      .closePath()
      .fill(0xffffff)
      .stroke(FINE);
  },

  grass: (w, h) =>
    new Graphics()
      .moveTo(w * 0.5, h)
      .lineTo(w * 0.18, h * 0.3)
      .lineTo(w * 0.36, h * 0.34)
      .lineTo(w * 0.5, h * 0.08)
      .lineTo(w * 0.64, h * 0.34)
      .lineTo(w * 0.82, h * 0.3)
      .closePath()
      .fill(0xffffff)
      .stroke(FINE),

  // Reeds: upright stems with heads, all leaning one way, which is what a reed bed does.
  reed: (w, h) => {
    const shape = new Graphics();
    for (const [foot, lean, top] of [
      [0.28, 0.06, 0.1],
      [0.5, 0.1, 0.02],
      [0.72, 0.04, 0.18],
    ] as const) {
      shape
        .moveTo(w * foot, h)
        .lineTo(w * (foot + lean), h * top)
        .lineTo(w * (foot + lean + 0.09), h * (top + 0.14))
        .lineTo(w * (foot + lean + 0.02), h * (top + 0.3))
        .lineTo(w * (foot + 0.07), h)
        .closePath();
    }
    return shape.fill(0xffffff).stroke(FINE);
  },

  // A boulder: lumpy rather than round, because a circle reads as a shadow and not as stone.
  boulder: (w, h) =>
    new Graphics()
      .moveTo(w * 0.06, h)
      .lineTo(w * 0.14, h * 0.44)
      .lineTo(w * 0.42, h * 0.16)
      .lineTo(w * 0.72, h * 0.22)
      .lineTo(w * 0.94, h * 0.58)
      .lineTo(w * 0.9, h)
      .closePath()
      .fill(0xffffff)
      .stroke(LINE),

  cactus: (w, h) =>
    new Graphics()
      .moveTo(w * 0.42, h)
      .lineTo(w * 0.42, h * 0.08)
      .quadraticCurveTo(w * 0.5, h * -0.02, w * 0.58, h * 0.08)
      .lineTo(w * 0.58, h)
      .closePath()
      .moveTo(w * 0.42, h * 0.52)
      .lineTo(w * 0.2, h * 0.52)
      .quadraticCurveTo(w * 0.1, h * 0.5, w * 0.1, h * 0.36)
      .lineTo(w * 0.24, h * 0.36)
      .lineTo(w * 0.24, h * 0.42)
      .lineTo(w * 0.42, h * 0.42)
      .closePath()
      .moveTo(w * 0.58, h * 0.4)
      .lineTo(w * 0.78, h * 0.4)
      .quadraticCurveTo(w * 0.88, h * 0.38, w * 0.88, h * 0.24)
      .lineTo(w * 0.76, h * 0.24)
      .lineTo(w * 0.76, h * 0.3)
      .lineTo(w * 0.58, h * 0.3)
      .closePath()
      .fill(0xffffff)
      .stroke(FINE),
};

/**
 * What each kind is tinted.
 *
 * The shapes are drawn white so that one tint colours the whole of one, which is the only per-particle
 * colour Pixi will carry. These are the colours of the thing itself rather than of the ground it stands
 * on: a spruce is nearly black-green, a birch is pale, a snag is grey, sand-country things are dust.
 * They sit over the painted terrain, so they are darker than it almost everywhere - a pale sprite on a
 * pale wash disappears, and the whole point of a piece of scenery is that it is a mark on the ground.
 */
const COLOURS: Record<string, number> = {
  pine: 0x4a6b47,
  spruce: 0x37543c,
  birch: 0x8fae6a,
  oak: 0x5c8244,
  beech: 0x6b9150,
  palm: 0x5a9161,
  jungle: 0x2f7055,
  acacia: 0x8a9a52,
  mangrove: 0x47705c,
  snag: 0x9c9282,
  scrub: 0x8a9159,
  heather: 0x8f7a94,
  grass: 0x93ab63,
  reed: 0x9aa758,
  boulder: 0xa3968a,
  cactus: 0x6f8f5c,
};

/** The colour a kind is tinted, or a middling green for one nobody has chosen a colour for. */
export function colourFor(name: string): number {
  return COLOURS[name] ?? 0x6f8a55;
}

/** The shape a kind is drawn as, or the bush where the sprite map names one nobody has drawn. */
export function shapeFor(name: string, width: number, height: number): Graphics {
  return (SHAPES[name] ?? SHAPES.scrub!)(width, height);
}

/** Which kinds have a shape of their own, so a test can say when the sprite map has outgrown this. */
export function drawnKinds(): readonly string[] {
  return Object.keys(SHAPES);
}
