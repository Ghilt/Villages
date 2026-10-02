import { Container, Sprite } from 'pixi.js';

import type { Coverage } from '@villages/protocol';

import { isWithinView, toScreen } from '../geometry/cameraMath';
import type { CameraView } from '../geometry/cameraMath';
import { overTheFog } from './fogLayering';
import type { Layer } from './layer';
import type { Textures } from './markTextures';
import type { CameraSource, DrawnSprite, MapSprite } from './SpriteRenderer';
import {
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

/**
 * What each kind of mark looks like, in world units on the ground and in screen pixels as a sign.
 *
 * A house crosses over at zoom 8.46, where both forms are 22 pixels, and by zoom 10 its castle stands
 * 64. The four world units are a map convention and not a measurement: a surveyed castle is about a
 * tenth of a unit here, and would cross over at zoom fourteen, four levels past where the camera stops.
 *
 * A candidate has no ground form at all. It is a question the world is asking rather than a thing
 * standing in the world, so it is the same size wherever the camera is.
 *
 * A character is a person, smaller than a house on the ground and as a sign: a figure a unit and a half
 * tall, and a bust of sixteen pixels. They cross over at zoom 9.4, just in from zoom 9 where a key
 * figure's significance first has them drawn, so they arrive as the sign and stand up as the camera comes
 * in; by zoom 10 the figure is 24 pixels beside a castle's 64.
 */
const KINDS: Record<MapSprite['kind'], TwoForms> = {
  house: { groundHeight: 4, iconHeight: 22 },
  candidate: { iconHeight: 26 },
  character: { groundHeight: 1.5, iconHeight: 16 },
};

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
  /**
   * Whether it stands in vision, which puts its ground form over the fog rather than under it. Worked out
   * when the mark or the house's vision changes, never a frame. See `fogLayering.ts`.
   */
  inVision: boolean;
}

/**
 * The marks: every house, person and offered seat, in both of its forms, and the ring under the one selected.
 *
 * Two things in the stack rather than one, because the fog lies between them: under it, the ground forms of
 * whatever stands outside vision, and over it every icon and whatever stands in vision. See `fogLayering.ts`
 * and decision 0062.
 *
 * Each mark holds both of its forms at once and trades between them with alpha. They are never created
 * or destroyed by the zoom, only faded: putting the switch on existence rather than on appearance is
 * what keeps a camera resting on the crossover from churning sprites. See docs/adr/0051.
 */
export interface MarksLayer extends Layer {
  readonly underTheFog: Container;
  readonly overIt: Container;
  /** Replace what is on the map. The layer works out what appeared, changed and went away. */
  setSprites(sprites: readonly MapSprite[]): void;
  /**
   * Where a mark stands on the screen as last drawn, and how tall it is between its two forms, or null for one
   * not drawn: what the ring is put under.
   */
  standing(id: string, zoom: number): { x: number; y: number; tall: number } | null;
  /** Whether the distance floor is off every mark: see everything. */
  setEverything(on: boolean): void;
  /** What the house has in vision, for which side of the fog a mark's ground form is on; null without fog. */
  setVision(vision: Coverage | null): void;
  hitTest(point: { x: number; y: number }): string | null;
  /** Where every sprite actually ended up, for the development probe. */
  report(): Record<string, DrawnSprite>;
  /** How many marks stand in vision, for the fog's probe. */
  inVision(): number;
}

export function createMarksLayer(camera: CameraSource, textures: Textures): MarksLayer {
  const underTheFog = new Container();
  const overIt = new Container();
  const entries = new Map<string, Entry>();
  let everything = false;
  /** What the house has in vision, for asking whether a mark stands in it; nothing while there is no fog. */
  let vision: Coverage | null = null;
  const standsInVision = (at: { lng: number; lat: number }): boolean =>
    vision?.covers({ lat: at.lat, lon: at.lng }) ?? false;

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
      inVision: standsInVision(spec.at),
    };

    if (forms.groundHeight !== undefined) {
      const sprite = new Sprite(spec.kind === 'character' ? textures.figure : textures.castle);
      // The castle stands on the seat, and a person on their place, so the sprite hangs from its own
      // bottom edge.
      sprite.anchor.set(0.5, 1);
      sprite.tint = spec.tint;
      sprite.visible = false;
      (overTheFog('ground', entry.inVision) ? overIt : underTheFog).addChild(sprite);
      entry.ground = sprite;
    }
    if (forms.iconHeight !== undefined) {
      const sprite = new Sprite(
        spec.kind === 'candidate'
          ? textures.candidate
          : spec.kind === 'character'
            ? textures.bust
            : textures.mark,
      );
      // The same anchor as the ground form, because the two forms of one thing stand on one point: a
      // crossfade between two shapes hung from different places trades a jump in size for a jump in
      // position, and the eye catches a translation far harder than a scale. A candidate has only this
      // form, so it keeps its own: the staff's foot is the place, and the pennant flies above it.
      sprite.anchor.set(spec.kind === 'candidate' ? 0 : 0.5, 1);
      sprite.tint = spec.tint;
      sprite.visible = false;
      overIt.addChild(sprite);
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
   * Puts a mark's ground form on the side of the fog it now belongs on: over it in vision, under it outside.
   * Moving a sprite between two containers keeps it; nothing is made again.
   */
  function sideOfTheFog(entry: Entry): void {
    entry.inVision = standsInVision(entry.spec.at);
    const belongs = overTheFog('ground', entry.inVision) ? overIt : underTheFog;
    if (entry.ground !== null && entry.ground.parent !== belongs) {
      belongs.addChild(entry.ground);
    }
  }

  function hide(entry: Entry): void {
    if (entry.ground !== null) {
      entry.ground.visible = false;
    }
    if (entry.icon !== null) {
      entry.icon.visible = false;
    }
  }

  return {
    underTheFog,
    overIt,

    draw(view: CameraView, _now: number, elapsed: number): number | null {
      const { zoom } = view;
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

      // A trade still running wants the next frame: the map is not moving, so nothing else will ask.
      return trading ? 0 : null;
    },

    standing(id: string, zoom: number): { x: number; y: number; tall: number } | null {
      const on = entries.get(id);
      const above = on?.ground?.visible === true ? on.ground : on?.icon;
      if (on === undefined || above === null || above === undefined || !above.visible) {
        return null;
      }
      // Sized off the blend rather than off one form, because during the trade neither answers on its
      // own. At the crossover the two heights are equal, so this is a no-op exactly where it matters.
      const sizes = sizesAt(zoom, KINDS[on.spec.kind]);
      const alphas = alphasFor(on.blend);
      return { x: above.x, y: above.y, tall: sizes.ground * alphas.ground + sizes.icon * alphas.icon };
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
          // A person who moved may have walked into vision or out of it.
          sideOfTheFog(existing);
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
    },

    setEverything(on: boolean): void {
      everything = on;
    },

    setVision(next: Coverage | null): void {
      vision = next;
      for (const entry of entries.values()) {
        sideOfTheFog(entry);
      }
    },

    hitTest(point: { x: number; y: number }): string | null {
      let nearest: { id: string; away: number } | null = null;

      for (const [id, entry] of entries) {
        // A mark on its way out takes no clicks: it is not a thing on the map any more, it is the
        // last of a picture of one.
        // A candidate is a place being offered rather than a thing standing in the world, so it is not
        // one; a house and a person are.
        if (entry.spec.kind === 'candidate' || entry.leaving) {
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

    report(): Record<string, DrawnSprite> {
      return Object.fromEntries(
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
              groundOverTheFog: entry.ground !== null && entry.ground.parent === overIt,
            } satisfies DrawnSprite,
          ];
        }),
      );
    },

    inVision(): number {
      return [...entries.values()].filter((entry) => entry.inVision).length;
    },

    destroy(): void {
      entries.clear();
    },
  };
}
