import { Graphics } from 'pixi.js';

import type { ScreenPoint } from '../../geometry/cameraMath';
import type { Splash } from './splash';

/**
 * What a die throws up as it strikes the ground, drawn on the screen round where it struck: a puff of dust, sand, grit
 * or snow, a splash of droplets and a ripple on water, leaves fluttering down in a wood. As big as `strength`, from
 * nought to one, which the die's size and how hard it struck make. See `splash.ts` for which where.
 */
export interface Dust {
  readonly graphics: Graphics;
  burst(at: ScreenPoint, strength: number, now: number, splash?: Splash): void;
  /** Draws what is still in the air, and says whether anything is. */
  draw(now: number, lean: number): boolean;
  destroy(): void;
}

/** How long each lasts, in milliseconds: dust settles quickly, a splash falls back, leaves take their time. */
const LASTS: Readonly<Record<Splash, number>> = {
  dust: 420,
  sand: 480,
  grit: 380,
  snow: 520,
  water: 620,
  leaves: 950,
};

/** The colour of each puff. */
const PUFF: Readonly<Record<'dust' | 'sand' | 'grit' | 'snow', number>> = {
  dust: 0xcdbb98,
  sand: 0xe0c58c,
  grit: 0x9b968c,
  snow: 0xf3f5f7,
};

const DROPLET = 0xd8eaf4;
const RIPPLE = 0xeaf4f8;
const LEAVES = [0x5f7f34, 0x7f9a3c, 0x9a6b2f, 0x6e8a2e] as const;

interface Puff {
  readonly at: ScreenPoint;
  readonly strength: number;
  readonly since: number;
  readonly splash: Splash;
}

export function createDust(): Dust {
  const graphics = new Graphics();
  let puffs: Puff[] = [];
  return {
    graphics,
    burst(at, strength, now, splash = 'dust') {
      puffs.push({ at, strength: Math.min(1, strength), since: now, splash });
    },
    draw(now, lean) {
      puffs = puffs.filter((puff) => now - puff.since < LASTS[puff.splash]);
      graphics.clear();
      for (const puff of puffs) {
        const age = (now - puff.since) / LASTS[puff.splash];
        if (puff.splash === 'water') drawSplash(graphics, puff, age, lean);
        else if (puff.splash === 'leaves') drawLeaves(graphics, puff, age, lean);
        else drawPuff(graphics, puff, age, lean, PUFF[puff.splash]);
      }
      return puffs.length > 0;
    },
    destroy() {
      graphics.destroy();
    },
  };
}

/** A ring of motes blown out from where it struck, fading as they go; grit throws a few chips further. */
function drawPuff(graphics: Graphics, puff: Puff, age: number, lean: number, colour: number): void {
  for (let mote = 0; mote < 6; mote++) {
    const way = (mote / 6) * Math.PI * 2 + puff.strength;
    const out = (10 + 26 * puff.strength) * Math.sqrt(age);
    graphics
      .circle(
        puff.at.x + Math.cos(way) * out,
        puff.at.y + Math.sin(way) * out * lean,
        2 + 5 * puff.strength * (1 - age),
      )
      .fill({ color: colour, alpha: 0.5 * (1 - age) });
  }
  if (puff.splash !== 'grit') return;
  for (let chip = 0; chip < 4; chip++) {
    const way = (chip / 4) * Math.PI * 2 + 0.4;
    const out = (16 + 34 * puff.strength) * age;
    const up = (14 * puff.strength + 6) * 4 * age * (1 - age);
    graphics
      .rect(puff.at.x + Math.cos(way) * out - 1, puff.at.y + Math.sin(way) * out * lean - up - 1, 2.2, 2.2)
      .fill({ color: 0x5f5a52, alpha: 1 - age });
  }
}

/** Droplets thrown up and falling back, and a ripple spreading on the water. */
function drawSplash(graphics: Graphics, puff: Puff, age: number, lean: number): void {
  const ripple = (6 + 30 * puff.strength) * Math.sqrt(age);
  graphics
    .ellipse(puff.at.x, puff.at.y, ripple, ripple * lean)
    .stroke({ width: 1.5, color: RIPPLE, alpha: 0.7 * (1 - age) });
  for (let drop = 0; drop < 9; drop++) {
    const way = (drop / 9) * Math.PI * 2 + 0.3;
    const out = (8 + 20 * puff.strength) * age * (0.7 + 0.3 * ((drop * 7) % 3));
    // Up and back down again, over the splash's life.
    const up = (18 + 30 * puff.strength) * 4 * age * (1 - age);
    graphics
      .circle(
        puff.at.x + Math.cos(way) * out,
        puff.at.y + Math.sin(way) * out * lean - up,
        1.6 + 1.6 * puff.strength,
      )
      .fill({ color: DROPLET, alpha: 0.85 * (1 - age * age) });
  }
}

/** Leaves knocked loose, thrown out and up, then fluttering down, turning as they go. */
function drawLeaves(graphics: Graphics, puff: Puff, age: number, lean: number): void {
  for (let leaf = 0; leaf < 7; leaf++) {
    const way = (leaf / 7) * Math.PI * 2 + 0.7;
    const out = (10 + 22 * puff.strength) * Math.sqrt(age);
    const up = (16 + 22 * puff.strength) * Math.sin(Math.PI * Math.min(1, age * 1.4)) - 8 * age;
    const sway = Math.sin(age * 11 + leaf) * 4;
    const x = puff.at.x + Math.cos(way) * out + sway;
    const y = puff.at.y + Math.sin(way) * out * lean - up;
    const turn = age * 9 + leaf;
    const long = 3 + 1.5 * puff.strength;
    const wide = long * 0.45 * Math.abs(Math.cos(turn));
    const along = { x: Math.cos(turn) * long, y: Math.sin(turn) * long };
    const across = { x: -Math.sin(turn) * wide, y: Math.cos(turn) * wide };
    graphics
      .poly([
        x + along.x,
        y + along.y,
        x + across.x,
        y + across.y,
        x - along.x,
        y - along.y,
        x - across.x,
        y - across.y,
      ])
      .fill({ color: LEAVES[leaf % LEAVES.length]!, alpha: 1 - age ** 3 });
  }
}
