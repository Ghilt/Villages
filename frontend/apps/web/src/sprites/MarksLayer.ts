import { Container, Sprite } from 'pixi.js';

import type { Coverage } from '@villages/protocol';

import { isWithinView, toScreen } from '../geometry/cameraMath';
import { note } from '../log/log';
import type { CameraView } from '../geometry/cameraMath';
import { groundSideOf } from './fogLayering';
import type { Layer } from './layer';
import { castShadow, dress, drawnOf, flyPennant, hide, letGo, show, wearBadge } from './markEntry';
import type { Entry } from './markEntry';
import { groupMarks } from './markGroups';
import { hitAmong } from './markHits';
import type { Groups, Placed } from './markGroups';
import { lookOf } from './markLooks';
import type { Textures } from './markTextures';
import type { CameraSource, DrawnSprite, MapSprite } from './SpriteRenderer';
import { ringUnder } from './ringPlace';
import type { RingPlace } from './ringPlace';
import type { StandingLayer } from './standing/StandingLayer';
import { standingOf } from './standing/standingOf';
import { dressSettlement, placeSettlement } from './settlements/settlementDress';
import { PRESENCE_MS, alphasFor, easeTowards, midTrade, sizesAt, wantedForm } from './twoForms';

/**
 * The marks: every house, person, structure and offered seat, in both of its forms, a structure's pennant over it.
 *
 * Two things in the stack rather than one, because the fog lies between them: under it, the ground forms of
 * whatever stands outside vision, and over it every icon and whatever stands in vision. A structure's ground form is
 * in neither: it stands among the trees, wherever it is. See `fogLayering.ts` and decisions 0062 and 0110.
 *
 * Each mark holds both of its forms at once and trades between them with alpha. They are never created
 * or destroyed by the zoom, only faded: putting the switch on existence rather than on appearance is
 * what keeps a camera resting on the crossover from churning sprites. See docs/adr/0051.
 */
/** Where an icon was drawn this frame, in CSS pixels: its middle, its larger side, and how much of it is there. */
export interface IconDrawn {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

export interface MarksLayer extends Layer {
  /** The shadows the buildings cast, laid on the ground under the fog and the trees, wherever the building is drawn. */
  readonly shadows: Container;
  readonly underTheFog: Container;
  readonly overIt: Container;
  /** Replace what is on the map. The layer works out what appeared, changed and went away. */
  setSprites(sprites: readonly MapSprite[]): void;
  /** Where the ring lies under a mark as last drawn, round the ground it stands on, or null for one not drawn. */
  ringUnder(id: string, view: CameraView): RingPlace | null;
  /** What the house has in vision, for which side of the fog a mark's ground form is on; null without fog. */
  setVision(vision: Coverage | null): void;
  /**
   * The mark or the crowd under a point: a mark's own id, or `group:<leader>` for the "+N" a crowd's leader wears.
   * A mark hidden in a crowd takes no clicks.
   */
  hitTest(point: { x: number; y: number }): string | null;
  /** Every mark of the crowd a mark leads as last drawn, the leader first and the rest in rank order. */
  groupOf(leader: string): readonly string[];
  /** Where every sprite actually ended up, for the development probe. */
  report(): Record<string, DrawnSprite>;
  /** How many marks stand in vision, for the fog's probe. */
  inVision(): number;
  /** Every icon drawn this frame, for the clouds to keep clear of: the layer draws before them. */
  iconsDrawn(): readonly IconDrawn[];
}

export function createMarksLayer(
  camera: CameraSource,
  textures: Textures,
  darkness: () => number,
  amongTheTrees: StandingLayer,
): MarksLayer {
  const shadows = new Container();
  const underTheFog = new Container();
  const overIt = new Container();
  const entries = new Map<string, Entry>();
  /** The crowds far out, as last drawn. */
  let groups: Groups = { led: new Map(), leaderOf: new Map() };
  /** The icons as last drawn. */
  let icons: IconDrawn[] = [];
  /** How the crowds were last said in the log, so it speaks only when they change. */
  let said = '';
  /** What the house has in vision, for asking whether a mark stands in it; nothing while there is no fog. */
  let vision: Coverage | null = null;
  const standsInVision = (at: { lng: number; lat: number }): boolean =>
    vision?.covers({ lat: at.lat, lon: at.lng }) ?? false;
  /** Where a mark's ground form is drawn: a structure's among the trees, a person's on its side of the fog. */
  const sides = { among: amongTheTrees.view, over: overIt, under: underTheFog };
  const groundSide = (entry: Entry): Container => sides[groundSideOf(entry.spec.kind, entry.inVision)];

  /**
   * Makes the sprites a mark needs, dressed as its look says.
   *
   * The texture, the anchor and the tint are all settled here because none of them depends on the zoom
   * any more. Only the height and the alpha change as the camera moves, which is two numbers a frame.
   */
  function sproutFor(spec: MapSprite): Entry {
    const look = lookOf(spec, textures);
    // Settled, not mid-trade: a house arriving while the camera is still should already be whichever
    // form this zoom calls for, rather than fading in from the other one.
    const showing = wantedForm(camera.zoom(), look.forms, 'icon');
    // Settled in its form, but not yet present: a mark fades up rather than appearing whole.
    const entry: Entry = {
      spec,
      look,
      ground: null,
      icon: null,
      pennant: null,
      shadow: null,
      showing,
      blend: showing === 'ground' ? 1 : 0,
      presence: 0,
      leaving: false,
      grouped: 1,
      badge: null,
      inVision: standsInVision(spec.at),
      settlement: null,
    };

    if (look.ground !== null) {
      const sprite = new Sprite(look.ground);
      // The castle stands on the seat, a person on their place and a structure on its own, so the sprite
      // hangs from its own bottom edge, at its foot.
      sprite.anchor.set(look.groundAnchor, 1);
      sprite.tint = spec.tint;
      sprite.visible = false;
      groundSide(entry).addChild(sprite);
      entry.ground = sprite;
    }
    dress(entry, textures.pennant, overIt, shadows);
    dressSettlement(entry, textures.settlements, amongTheTrees.view, shadows);
    return entry;
  }

  /** Tells the log how many crowds there are far out and how many marks they hide, when that changes. */
  function sayCrowds(): void {
    const crowds = [...groups.led.values()].filter((one) => one.length > 1);
    const now =
      crowds.length === 0
        ? ''
        : `${crowds.length} crowds of marks, ${groups.leaderOf.size} marks hidden in them`;
    if (now !== said) {
      said = now;
      note('marks', now === '' ? 'no crowds of marks: every mark stands alone' : now);
    }
  }

  /**
   * Puts a mark's ground form where it now belongs: over the fog in vision, under it outside, a structure's among the
   * trees wherever it is. Moving a sprite between containers keeps it, and its pennant follows it as it is flown.
   */
  function sideOfTheFog(entry: Entry): void {
    entry.inVision = standsInVision(entry.spec.at);
    const belongs = groundSide(entry);
    if (entry.ground !== null && entry.ground.parent !== belongs) {
      belongs.addChild(entry.ground);
    }
  }

  return {
    shadows,
    underTheFog,
    overIt,

    draw(view: CameraView, _now: number, elapsed: number): number | null {
      const { zoom } = view;
      const dark = darkness();
      let trading = false;
      const gone: string[] = [];
      // Where each mark on the screen stands this frame, worked out first, because which of them are hidden in a
      // crowd depends on all the others.
      const onScreen: {
        entry: Entry;
        point: { x: number; y: number };
        sizes: { ground: number; icon: number };
      }[] = [];
      const placed: Placed[] = [];

      for (const [id, entry] of entries) {
        const forms = entry.look.forms;
        // The camera decides which form, once and hard; time decides how long it takes to get there.
        // Advanced for every mark, on screen or not, so one that comes back into view is not stale.
        entry.showing = wantedForm(zoom, forms, entry.showing);
        entry.blend = easeTowards(entry.blend, entry.showing === 'ground' ? 1 : 0, elapsed);

        // Arriving and going, and nothing else: being far away is the switch at `BECOMES_A_MARK_AT`, where a thing
        // with no mark has nothing to be drawn as. A mark never fades for distance; it gathers into crowds. See 0096.
        const here = !entry.leaving;
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

        onScreen.push({ entry, point, sizes });
        // Only a mark showing as its mark can be in a crowd: close in, every building is itself.
        if (entry.icon !== null && entry.showing === 'icon' && entry.spec.kind !== 'candidate') {
          const wide = (sizes.icon * entry.icon.texture.width) / entry.icon.texture.height;
          placed.push({
            id,
            ...point,
            width: wide,
            height: sizes.icon,
            significance: entry.spec.significance ?? 0,
          });
        }
      }

      groups = groupMarks(placed);
      sayCrowds();
      icons = [];
      for (const { entry, point, sizes } of onScreen) {
        const id = entry.spec.id;
        entry.grouped = easeTowards(entry.grouped, groups.leaderOf.has(id) ? 0 : 1, elapsed, PRESENCE_MS);
        trading = trading || midTrade(entry.grouped);
        const here = entry.presence * entry.grouped;
        const alphas = alphasFor(entry.blend);
        show(entry.ground, sizes.ground, alphas.ground * here);
        show(entry.icon, sizes.icon, alphas.icon * here);
        castShadow(entry, sizes.ground, alphas.ground * here * dark, point);
        placeSettlement(entry, point, view, alphas.ground * here, dark);

        for (const sprite of [entry.ground, entry.icon]) {
          if (sprite !== null && sprite.visible) {
            sprite.x = point.x;
            sprite.y = point.y;
          }
        }
        const icon = entry.icon;
        if (icon?.visible === true) {
          icons.push({
            x: icon.x + (0.5 - icon.anchor.x) * icon.width,
            y: icon.y + (0.5 - icon.anchor.y) * icon.height,
            size: Math.max(icon.width, icon.height),
            alpha: icon.alpha,
          });
        }
        flyPennant(entry, sizes.ground * alphas.ground + sizes.icon * alphas.icon, point, overIt);
        wearBadge(
          entry,
          (groups.led.get(id)?.length ?? 1) - 1,
          point,
          sizes.icon,
          alphas.icon * here,
          overIt,
        );
      }

      for (const id of gone) {
        const entry = entries.get(id);
        if (entry !== undefined) {
          letGo(entry);
        }
        entries.delete(id);
      }
      amongTheTrees.stand([...entries.values()].flatMap((entry) => standingOf(entry) ?? []));

      // A trade still running wants the next frame: the map is not moving, so nothing else will ask.
      return trading ? 0 : null;
    },

    ringUnder(id: string, view: CameraView): RingPlace | null {
      const on = entries.get(id);
      return on === undefined ? null : ringUnder(on, view);
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
          // A structure a level up is larger, and one that changed hands flies another pennant or none.
          existing.look = lookOf(spec, textures);
          if (existing.ground !== null && existing.look.ground !== null) {
            existing.ground.texture = existing.look.ground;
            // The atlas read after it sprouted measures a foot the picture drawn in code had not.
            existing.ground.anchor.set(existing.look.groundAnchor, 1);
            existing.ground.tint = spec.tint;
          }
          dress(existing, textures.pennant, overIt, shadows);
          dressSettlement(existing, textures.settlements, amongTheTrees.view, shadows);
          // A person who moved may have walked into vision or out of it.
          sideOfTheFog(existing);
        }
      }

      // A mark that has gone is not destroyed here. It is marked as leaving, fades out over the next
      // frames, and is let go of once there is nothing left of it to see. Nothing on the map vanishes
      // between one frame and the next.
      for (const [id, entry] of entries) {
        entry.leaving = !seen.has(id);
      }
    },

    setVision(next: Coverage | null): void {
      vision = next;
      for (const entry of entries.values()) {
        sideOfTheFog(entry);
      }
    },

    hitTest: (point) => hitAmong(entries, point),

    groupOf(leader: string): readonly string[] {
      return groups.led.get(leader) ?? [];
    },

    report(): Record<string, DrawnSprite> {
      return Object.fromEntries([...entries].map(([id, entry]) => [id, drawnOf(entry, overIt)]));
    },

    iconsDrawn(): readonly IconDrawn[] {
      return icons;
    },

    inVision(): number {
      return [...entries.values()].filter((entry) => entry.inVision).length;
    },

    destroy(): void {
      entries.clear();
    },
  };
}
