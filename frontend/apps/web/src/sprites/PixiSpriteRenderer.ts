import { Application, Container, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';

import { isWithinView, toScreen } from './cameraMath';
import type { CameraView } from './cameraMath';
import {
  LONGEST_STEP_MS,
  PRESENCE_MS,
  alphasFor,
  easeTowards,
  formForHit,
  isDrawn,
  midTrade,
  sizesAt,
  wantedForm,
} from './twoForms';
import type { Form, TwoForms } from './twoForms';
import { createSceneryLayer } from './scenery/SceneryLayer';
import { noteDrawn } from './scenery/sceneryCells';
import type { CameraSource, MapSprite, SceneryHow, SpriteRenderer } from './SpriteRenderer';

/**
 * What each shape is laid out in. Every one is drawn far larger than it is ever shown and scaled
 * down, so that coming close finds detail rather than a smear.
 *
 * These are not the sizes the textures come out at: `generateTexture` crops to the ink. What a sprite
 * is scaled against is its own texture's height, in `show`.
 */
const TEXTURE = {
  castleHeight: 160,
  castleWidth: 150,
  markHeight: 64,
  markWidth: 48,
  candidateHeight: 64,
  candidateWidth: 44,
  ringDiameter: 128,
} as const;

/**
 * What each kind of mark looks like, in world units on the ground and in screen pixels as a sign.
 *
 * A house crosses over at zoom 8.46, where both forms are 22 pixels, and by zoom 10 its castle stands
 * 64. The four world units are a map convention and not a measurement: a surveyed castle is about a
 * tenth of a unit here, and would cross over at zoom fourteen, four levels past where the camera stops.
 *
 * A candidate has no ground form at all. It is a question the world is asking rather than a thing
 * standing in the world, so it is the same size wherever the camera is.
 */
const KINDS: Record<MapSprite['kind'], TwoForms> = {
  house: { groundHeight: 4, iconHeight: 22 },
  candidate: { iconHeight: 26 },
};

/**
 * What marks the selected house. The interface's own ink rather than its gold: the ground a house holds
 * is drawn in gold already, and a gold ring on a gold field is a ring nobody can see.
 */
const SELECTED = 0x241c14;

/** What the development probe reports about one sprite. */
export interface DrawnSprite {
  x: number;
  y: number;
  visible: boolean;
  /** Which form is drawn, or `both` while they are trading places. */
  form: 'ground' | 'icon' | 'both' | 'none';
  /** How tall it is on the screen right now, which is what a ground-anchored size is checked by. */
  height: number;
  /** How much of it is here: nought on its way out, one arrived. */
  presence: number;
}

interface Entry {
  spec: MapSprite;
  /** The thing itself, standing on its ground. Null for a kind that has no ground form. */
  ground: Sprite | null;
  /** The sign for it. Null for a kind that is only ever itself. */
  icon: Sprite | null;
  /** Which form the camera says this should be showing. Changes at the crossover, not gradually. */
  showing: Form;
  /** Where the trade between them has got to: nought the icon, one the ground form. */
  blend: number;
  /**
   * How much of this mark is here at all: nought gone, one arrived.
   *
   * Apart from the blend, because they answer different questions and can run at once: a house may
   * arrive at a zoom that also wants it to change form. Multiplied together at the end.
   */
  presence: number;
  /** No longer among the marks to draw. It fades out and is let go of when it reaches nothing. */
  leaving: boolean;
}

interface Textures {
  castle: Texture;
  mark: Texture;
  candidate: Texture;
  ring: Texture;
}

/**
 * Sprites drawn on a transparent canvas above the map, moved to follow the camera whenever it moves.
 *
 * The map owns the camera; this only reads it. Positions are computed from the camera centre by the pure
 * functions in `cameraMath`, which is why nothing here needs to know about projections. See docs/adr/0005.
 *
 * It draws when the map draws, on the map's own `render`, rather than on an animation frame of its own.
 * That is what keeps the two canvases agreeing: one camera, read once, into one browser frame. A still
 * map draws nothing at all.
 *
 * Each mark holds both of its forms at once and trades between them with alpha. They are never created
 * or destroyed by the zoom, only faded: putting the switch on existence rather than on appearance is
 * what keeps a camera resting on the crossover from churning sprites. See docs/adr/0051.
 */
export function createPixiSpriteRenderer(camera: CameraSource): SpriteRenderer {
  const app = new Application();
  const stage = new Container();
  const entries = new Map<string, Entry>();

  let textures: Textures | null = null;
  let selected: string | null = null;
  let everything = false;
  let ring: Sprite | null = null;
  let disposed = false;
  let unwatch: (() => void) | null = null;
  /** What the canvas was last sized to, so it is only resized when the map's box actually changed. */
  let canvasWas = { width: 0, height: 0 };
  /** When the last frame was drawn, so a trade moves on by real time rather than by frames. */
  let lastFrameAt = 0;
  /** A frame owed to a trade still running. The camera is not moving, so nobody else will ask. */
  let owed: number | null = null;
  let scenery: ReturnType<typeof createSceneryLayer> | null = null;
  let how: SceneryHow = { on: false, dial: 1, laterBy: 0, tilesRoot: '' };
  /** The worst gap between two frames of a moving map, which is what a stutter is. */
  let worstGapMs = 0;
  /** When the last frame was actually drawn, which is what a frame gap is measured between. */
  let lastDrawnAt = 0;

  /**
   * One shape, rasterised once, with the smaller copies of itself that a downscale needs.
   *
   * Every shape here is drawn far larger than it is shown, and without mipmaps that samples about one
   * texel in twenty. The outline then sparkles whenever the sprite lands on a different fraction of a
   * pixel, which is every frame the map moves, and on a display at 125 or 150 per cent it never lands
   * on a whole one at all. The levels are built once, here.
   */
  function rasterise(shape: Graphics): Texture {
    return app.renderer.generateTexture({
      target: shape,
      textureSourceOptions: { autoGenerateMipmaps: true, scaleMode: 'linear' },
    });
  }

  function buildTextures(): Textures {
    const { castleWidth: w, castleHeight: h } = TEXTURE;

    // The ground form: a castle, two towers with a battlemented wall between them, drawn in white so
    // that a tint can colour it per house. One outline, because a tinted sprite with seams shows them.
    // Everything is a fraction of the texture, so the drawing survives being given a different size.
    const tower = w * 0.267;
    const towerTop = h * 0.3;
    const wallTop = h * 0.56;
    const crenel = h * 0.094;
    const gap = w * 0.089;
    const castle = new Graphics()
      .moveTo(3, h - 3)
      .lineTo(3, towerTop)
      .lineTo(3 + tower / 3, towerTop)
      .lineTo(3 + tower / 3, towerTop - crenel)
      .lineTo(3 + (tower * 2) / 3, towerTop - crenel)
      .lineTo(3 + (tower * 2) / 3, towerTop)
      .lineTo(3 + tower, towerTop)
      .lineTo(3 + tower, wallTop)
      .lineTo(w / 2 - gap, wallTop)
      .lineTo(w / 2 - gap, wallTop - crenel)
      .lineTo(w / 2 + gap, wallTop - crenel)
      .lineTo(w / 2 + gap, wallTop)
      .lineTo(w - 3 - tower, wallTop)
      .lineTo(w - 3 - tower, towerTop)
      .lineTo(w - 3 - (tower * 2) / 3, towerTop)
      .lineTo(w - 3 - (tower * 2) / 3, towerTop - crenel)
      .lineTo(w - 3 - tower / 3, towerTop - crenel)
      .lineTo(w - 3 - tower / 3, towerTop)
      .lineTo(w - 3, towerTop)
      .lineTo(w - 3, h - 3)
      .closePath()
      .fill(0xffffff)
      .stroke({ width: 6, color: 0x4a4034, alpha: 0.85 });

    // The icon: the same castle said in three strokes. The detailed one is unreadable at 22 pixels -
    // its crenellations come to two pixels and its outline eats the fill - so the sign is a keep with
    // three merlons and nothing else. What it has to do is read as a castle at the size of a word.
    const { markWidth: mw, markHeight: mh } = TEXTURE;
    const top = mh * 0.16;
    const shoulder = mh * 0.34;
    const mark = new Graphics()
      .moveTo(4, mh - 3)
      .lineTo(4, top)
      .lineTo(mw * 0.3, top)
      .lineTo(mw * 0.3, shoulder)
      .lineTo(mw * 0.42, shoulder)
      .lineTo(mw * 0.42, top)
      .lineTo(mw * 0.58, top)
      .lineTo(mw * 0.58, shoulder)
      .lineTo(mw * 0.7, shoulder)
      .lineTo(mw * 0.7, top)
      .lineTo(mw - 4, top)
      .lineTo(mw - 4, mh - 3)
      .closePath()
      .fill(0xffffff)
      .stroke({ width: 5, color: 0x4a4034, alpha: 0.9 });

    // A pennant on a staff: a place the world is offering, rather than a house that stands there.
    const { candidateWidth: cw, candidateHeight: ch } = TEXTURE;
    const candidate = new Graphics()
      .moveTo(4, 2)
      .lineTo(cw - 2, 12)
      .lineTo(4, 22)
      .closePath()
      .fill(0xffffff)
      .rect(0, 0, 5, ch)
      .fill(0xffffff)
      .stroke({ width: 3, color: 0x4a4034, alpha: 0.85 });

    // What marks the selected house: a ring on the ground under it rather than a change to the mark
    // itself, so that what is selected is still drawn as what it is.
    const r = TEXTURE.ringDiameter;
    const ringOf = new Graphics()
      .ellipse(r / 2, r / 2, r / 2 - 4, r / 4 - 4)
      .stroke({ width: 6, color: 0xffffff, alpha: 1 });

    const built = {
      castle: rasterise(castle),
      mark: rasterise(mark),
      candidate: rasterise(candidate),
      ring: rasterise(ringOf),
    };
    castle.destroy();
    mark.destroy();
    candidate.destroy();
    ringOf.destroy();
    return built;
  }

  /**
   * Makes the sprites a kind needs, dressed once and never dressed again.
   *
   * The texture, the anchor and the tint are all settled here because none of them depends on the zoom
   * any more. Only the height and the alpha change as the camera moves, which is two numbers a frame.
   */
  function sproutFor(spec: MapSprite): Entry {
    const forms = KINDS[spec.kind];
    // Settled, not mid-trade: a house arriving while the camera is still should already be whichever
    // form this zoom calls for, rather than fading in from the other one.
    const showing = wantedForm(camera.zoom(), forms, 'icon');
    // Settled in its form, but not yet present: a mark fades up rather than appearing whole.
    const entry: Entry = {
      spec,
      ground: null,
      icon: null,
      showing,
      blend: showing === 'ground' ? 1 : 0,
      presence: 0,
      leaving: false,
    };
    if (textures === null) {
      return entry;
    }

    if (forms.groundHeight !== undefined) {
      const sprite = new Sprite(textures.castle);
      // The castle stands on the seat, so the sprite hangs from its own bottom edge.
      sprite.anchor.set(0.5, 1);
      sprite.tint = spec.tint;
      sprite.visible = false;
      stage.addChild(sprite);
      entry.ground = sprite;
    }
    if (forms.iconHeight !== undefined) {
      const sprite = new Sprite(spec.kind === 'candidate' ? textures.candidate : textures.mark);
      // The same anchor as the ground form, because the two forms of one thing stand on one point: a
      // crossfade between two shapes hung from different places trades a jump in size for a jump in
      // position, and the eye catches a translation far harder than a scale. A candidate has only this
      // form, so it keeps its own: the staff's foot is the place, and the pennant flies above it.
      sprite.anchor.set(spec.kind === 'candidate' ? 0 : 0.5, 1);
      sprite.tint = spec.tint;
      sprite.visible = false;
      stage.addChild(sprite);
      entry.icon = sprite;
    }
    return entry;
  }

  /**
   * Draws one form at the height and the alpha the rule asked for.
   *
   * The scale is taken against the texture's own height rather than against the size the shape was
   * laid out in, because `generateTexture` crops to what was actually drawn: the castle is laid out in
   * 160 pixels and its ink covers about 132 of them. Dividing by the layout made a height of 45 pixels
   * come out as 37, which would have made "four world units" a polite fiction and the crossover land
   * somewhere other than where the arithmetic says.
   */
  function show(sprite: Sprite | null, height: number, alpha: number): void {
    if (sprite === null) {
      return;
    }
    if (alpha <= 0) {
      sprite.visible = false;
      return;
    }
    sprite.visible = true;
    sprite.alpha = alpha;
    sprite.scale.set(height / sprite.texture.height);
  }

  /**
   * Asks for one more frame, because a trade is still running.
   *
   * The map is not moving, so its `render` is not coming: this is the only thing that will carry a
   * trade to its end. It stops of its own accord the moment nothing is mid-trade, so a still map with
   * nothing changing on it still draws nothing.
   */
  function keepTrading(): void {
    if (owed !== null || disposed) {
      return;
    }
    owed = requestAnimationFrame(() => {
      owed = null;
      frame();
    });
  }

  function hide(entry: Entry): void {
    if (entry.ground !== null) {
      entry.ground.visible = false;
    }
    if (entry.icon !== null) {
      entry.icon.visible = false;
    }
  }

  function frame(): void {
    if (textures === null || disposed) {
      return;
    }
    const zoom = camera.zoom();
    const { width, height } = camera.size();
    // The map's box can change without the window changing, and Pixi's own `resizeTo` listens to the
    // window alone. So the canvas is sized from the box the projection is about to use, not from a
    // resize event that may never come.
    if (width !== canvasWas.width || height !== canvasWas.height) {
      canvasWas = { width, height };
      app.renderer.resize(width, height);
    }
    const view: CameraView = { center: camera.center(), zoom, width, height };

    const now = performance.now();
    // Capped, because a still map draws nothing and the gap since the last frame is then seconds. A
    // house arriving on a still map would otherwise be handed the whole of its fade in one step.
    const elapsed = Math.min(now - lastFrameAt, LONGEST_STEP_MS);
    lastFrameAt = now;
    let trading = false;

    const gone: string[] = [];

    for (const [id, entry] of entries) {
      const forms = KINDS[entry.spec.kind];
      // The camera decides which form, once and hard; time decides how long it takes to get there.
      // Advanced for every mark, on screen or not, so one that comes back into view is not stale.
      entry.showing = wantedForm(zoom, forms, entry.showing);
      entry.blend = easeTowards(entry.blend, entry.showing === 'ground' ? 1 : 0, elapsed);

      // A candidate is what the player is being asked about, so it is drawn however far back the
      // camera is; so is a house the player has asked to keep in sight. Everything else goes with the
      // rest of the world's furniture. Distance, not size: see 0038.
      const spared = entry.spec.kind === 'candidate' || entry.spec.always === true;
      const here = !entry.leaving && isDrawn(zoom, { everything, spared });
      entry.presence = easeTowards(entry.presence, here ? 1 : 0, elapsed, PRESENCE_MS);
      trading = trading || midTrade(entry.blend) || midTrade(entry.presence);

      // Gone, and now faded out, so it can be let go of. Collected rather than deleted here, because
      // this is walking the very map it would be deleted from.
      if (entry.leaving && entry.presence === 0) {
        gone.push(id);
        hide(entry);
        continue;
      }

      const sizes = sizesAt(zoom, forms);
      // The margin is the mark's own height rather than a constant, because a ground form at the
      // closest zoom is taller than any fixed margin worth writing down.
      const reach = Math.max(sizes.ground, sizes.icon) + 8;
      const point = toScreen(entry.spec.at, view);

      // Being off the screen is not the same as being gone, so it hides without touching the presence
      // above. A mark panned back into view was there all along and arrives whole, rather than fading
      // up at the edge as though it had just been founded.
      if (entry.presence === 0 || !isWithinView(point, view, reach)) {
        hide(entry);
        continue;
      }

      const alphas = alphasFor(entry.blend);
      show(entry.ground, sizes.ground, alphas.ground * entry.presence);
      show(entry.icon, sizes.icon, alphas.icon * entry.presence);

      for (const sprite of [entry.ground, entry.icon]) {
        if (sprite !== null && sprite.visible) {
          sprite.x = point.x;
          sprite.y = point.y;
        }
      }
    }

    for (const id of gone) {
      const entry = entries.get(id);
      entry?.ground?.destroy();
      entry?.icon?.destroy();
      entries.delete(id);
    }

    dressTheRing(zoom);

    if (scenery !== null) {
      scenery.container.visible = how.on;
      const drew = how.on
        ? scenery.update(view, how.tilesRoot, how.dial, how.laterBy, keepTrading)
        : { particles: 0, showing: 0, cells: 0, waiting: 0 };
      // Only gaps short enough to be a moving map are counted. A still map draws nothing, so the gap
      // since its last frame is seconds, and reporting that as a frame gap would be the panel lying
      // about a stall that never happened. See decision record 0023.
      const gap = now - lastDrawnAt;
      lastDrawnAt = now;
      if (gap > 0 && gap < 200) {
        worstGapMs = Math.max(worstGapMs, gap);
        noteDrawn({ ...drew, frameGapMs: gap, worstGapMs });
      } else {
        noteDrawn(drew);
      }
    }

    app.render();

    if (trading) {
      keepTrading();
    }
  }

  /** The ring sits on the ground under the selected house, marking what it stands on rather than it. */
  function dressTheRing(zoom: number): void {
    if (ring === null) {
      return;
    }
    const on = selected === null ? undefined : entries.get(selected);
    const above = on?.ground?.visible === true ? on.ground : on?.icon;
    if (on === undefined || above === null || above === undefined || !above.visible) {
      ring.visible = false;
      return;
    }
    // Sized off the blend rather than off one form, because during the trade neither answers on its
    // own. At the crossover the two heights are equal, so this is a no-op exactly where it matters.
    const sizes = sizesAt(zoom, KINDS[on.spec.kind]);
    const alphas = alphasFor(on.blend);
    const tall = sizes.ground * alphas.ground + sizes.icon * alphas.icon;
    // Wider than the mark it is under, or it would be a ring nobody can see behind a castle.
    ring.visible = true;
    ring.scale.set((tall * 1.7) / TEXTURE.ringDiameter);
    ring.x = above.x;
    ring.y = above.y;
  }

  return {
    async mount(container: HTMLElement): Promise<void> {
      await app.init({
        backgroundAlpha: 0,
        antialias: true,
        // Not `resizeTo`: it listens to the window, and the map's box changes without the window
        // changing whenever the stage folds or a pane takes room. `frame` sizes the canvas instead,
        // from the very box it is about to project against. See docs/adr/0039 and 0040.
        resolution: window.devicePixelRatio,
        autoDensity: true,
        // Nothing animates any more, so there is nothing for a clock of its own to do. The map says
        // when it has drawn and `frame` draws then.
        autoStart: false,
      });
      if (disposed) {
        app.destroy(true);
        return;
      }

      textures = buildTextures();
      // Under everything, because it is the ground the rest stands on.
      scenery = createSceneryLayer(app.renderer);
      stage.addChild(scenery.container);
      // Under every sprite, because it marks the ground a house stands on rather than the house.
      ring = new Sprite(textures.ring);
      ring.anchor.set(0.5, 0.5);
      ring.tint = SELECTED;
      ring.visible = false;
      stage.addChild(ring);
      app.stage.addChild(stage);
      container.appendChild(app.canvas);

      // One clock. The map draws, then this draws, from the camera the map just used, into the same
      // browser frame. Drawing on an animation frame of its own read the camera at a different instant,
      // so the marks trailed the ground for the length of every flight - which the comment that used to
      // stand here admitted, and accepted because the marks were never quite still. They are still now.
      lastFrameAt = performance.now();
      lastDrawnAt = lastFrameAt;
      unwatch = camera.watch(frame);
      frame();

      if (import.meta.env.DEV) {
        // Where every sprite actually ended up, for the console and for the end-to-end test, which has
        // no other way to ask a canvas what it drew.
        (window as unknown as { villagesSprites?: () => Record<string, DrawnSprite> }).villagesSprites = () =>
          Object.fromEntries(
            [...entries].map(([id, entry]) => {
              const onGround = entry.ground?.visible === true;
              const asIcon = entry.icon?.visible === true;
              const above = onGround ? entry.ground : entry.icon;
              return [
                id,
                {
                  x: above?.x ?? 0,
                  y: above?.y ?? 0,
                  visible: onGround || asIcon,
                  form: onGround && asIcon ? 'both' : onGround ? 'ground' : asIcon ? 'icon' : 'none',
                  height: above === null || above === undefined ? 0 : above.height,
                  presence: entry.presence,
                } satisfies DrawnSprite,
              ];
            }),
          );
      }
    },

    hitTest(point: { x: number; y: number }): string | null {
      let nearest: { id: string; away: number } | null = null;

      for (const [id, entry] of entries) {
        // A mark on its way out takes no clicks: it is not a thing on the map any more, it is the
        // last of a picture of one.
        if (entry.spec.kind !== 'house' || entry.leaving) {
          continue;
        }
        // One form answers, and the switch is at the crossover where the two are the same size, so the
        // thing you can hit never changes size either. Hitting whichever is more opaque would move the
        // target about mid-fade; hitting both would let an all-but-invisible ghost take a click.
        const which = formForHit(entry.blend);
        const sprite = which === 'ground' ? entry.ground : entry.icon;
        if (sprite === null || !sprite.visible) {
          continue;
        }
        const box = sprite.getBounds();
        if (point.x < box.minX || point.x > box.maxX || point.y < box.minY || point.y > box.maxY) {
          continue;
        }
        // Two marks can overlap where two houses are close. The nearer one is the one meant.
        const away = Math.hypot(point.x - sprite.x, point.y - sprite.y);
        if (nearest === null || away < nearest.away) {
          nearest = { id, away };
        }
      }

      return nearest?.id ?? null;
    },

    setSelected(id: string | null): void {
      selected = id;
      frame();
    },

    setEverything(on: boolean): void {
      everything = on;
      frame();
    },

    setScenery(next: SceneryHow): void {
      // A different scattering is a different world's worth of points, so what was cut is thrown away
      // rather than left to be a denser world's sparse half.
      const recut = next.dial !== how.dial || next.tilesRoot !== how.tilesRoot;
      how = next;
      if (recut) {
        scenery?.clear();
      }
      frame();
    },

    setSprites(sprites: readonly MapSprite[]): void {
      const seen = new Set<string>();

      for (const spec of sprites) {
        seen.add(spec.id);
        const existing = entries.get(spec.id);
        if (existing === undefined) {
          entries.set(spec.id, sproutFor(spec));
        } else {
          // Back again before it finished going. It fades up from wherever it had got to.
          existing.leaving = false;
          existing.spec = spec;
          if (existing.ground !== null) {
            existing.ground.tint = spec.tint;
          }
          if (existing.icon !== null) {
            existing.icon.tint = spec.tint;
          }
        }
      }

      // A mark that has gone is not destroyed here. It is marked as leaving, fades out over the next
      // frames, and is let go of once there is nothing left of it to see. Nothing on the map vanishes
      // between one frame and the next.
      for (const [id, entry] of entries) {
        entry.leaving = !seen.has(id);
      }

      // A house can arrive while the map is perfectly still, and a still map draws no frames.
      frame();
    },

    destroy(): void {
      disposed = true;
      scenery?.destroy();
      scenery = null;
      unwatch?.();
      unwatch = null;
      if (owed !== null) {
        cancelAnimationFrame(owed);
        owed = null;
      }
      entries.clear();
      if (app.renderer !== null && app.renderer !== undefined) {
        app.destroy(true, { children: true });
      }
    },
  };
}
