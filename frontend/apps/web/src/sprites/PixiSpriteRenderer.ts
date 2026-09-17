import { Application, Container, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';

import { isWithinView, toScreen } from './cameraMath';
import type { CameraView } from './cameraMath';
import {
  DOT_RADIUS,
  detailForMark,
  detailForZoom,
  idleMotionAt,
  markerHeightForZoom,
  phaseFor,
} from './spriteDetail';
import type { SpriteDetail } from './spriteDetail';
import type { CameraSource, MapSprite, SpriteRenderer } from './SpriteRenderer';

/** Every shape is drawn once, larger than it is ever shown, and scaled down to stay crisp. */
const TEXTURE = {
  markerHeight: 96,
  markerWidth: 90,
  dotDiameter: 32,
  candidateHeight: 64,
  candidateWidth: 44,
  ringDiameter: 128,
} as const;

/** How tall a candidate's mark is drawn on the screen, whatever the camera is doing. */
const CANDIDATE_HEIGHT = 26;

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
}

interface Entry {
  spec: MapSprite;
  sprite: Sprite;
  phase: number;
}

/**
 * Sprites drawn on a transparent canvas above the map, moved to follow the camera every frame.
 *
 * The map owns the camera; this only reads it. Positions are computed from the camera centre by the pure
 * functions in `cameraMath`, which is why nothing here needs to know about projections. See docs/adr/0005.
 */
export function createPixiSpriteRenderer(camera: CameraSource): SpriteRenderer {
  const app = new Application();
  const stage = new Container();
  const entries = new Map<string, Entry>();

  let textures: { marker: Texture; dot: Texture; candidate: Texture; ring: Texture } | null = null;
  let selected: string | null = null;
  let everything = false;
  let ring: Sprite | null = null;
  let drawnDetail: SpriteDetail | null = null;
  let started = 0;
  let disposed = false;

  function buildTextures(): { marker: Texture; dot: Texture; candidate: Texture; ring: Texture } {
    const { markerWidth: w, markerHeight: h, dotDiameter: d } = TEXTURE;

    // A castle: two towers with a battlemented wall between them, drawn in white so that a tint can
    // colour it per house. One outline, because a tinted sprite with seams in it shows them.
    const tower = 24;
    const towerTop = h * 0.3;
    const wallTop = h * 0.56;
    const crenel = 9;
    const marker = new Graphics()
      .moveTo(2, h - 2)
      .lineTo(2, towerTop)
      .lineTo(2 + tower / 3, towerTop)
      .lineTo(2 + tower / 3, towerTop - crenel)
      .lineTo(2 + (tower * 2) / 3, towerTop - crenel)
      .lineTo(2 + (tower * 2) / 3, towerTop)
      .lineTo(2 + tower, towerTop)
      .lineTo(2 + tower, wallTop)
      .lineTo(w / 2 - 8, wallTop)
      .lineTo(w / 2 - 8, wallTop - crenel)
      .lineTo(w / 2 + 8, wallTop - crenel)
      .lineTo(w / 2 + 8, wallTop)
      .lineTo(w - 2 - tower, wallTop)
      .lineTo(w - 2 - tower, towerTop)
      .lineTo(w - 2 - (tower * 2) / 3, towerTop)
      .lineTo(w - 2 - (tower * 2) / 3, towerTop - crenel)
      .lineTo(w - 2 - tower / 3, towerTop - crenel)
      .lineTo(w - 2 - tower / 3, towerTop)
      .lineTo(w - 2, towerTop)
      .lineTo(w - 2, h - 2)
      .closePath()
      .fill(0xffffff)
      .stroke({ width: 4, color: 0x4a4034, alpha: 0.85 });

    const dot = new Graphics()
      .circle(d / 2, d / 2, d / 2 - 3)
      .fill(0xffffff)
      .stroke({
        width: 3,
        color: 0x4a4034,
        alpha: 0.8,
      });

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
      marker: app.renderer.generateTexture(marker),
      dot: app.renderer.generateTexture(dot),
      candidate: app.renderer.generateTexture(candidate),
      ring: app.renderer.generateTexture(ringOf),
    };
    marker.destroy();
    dot.destroy();
    candidate.destroy();
    ringOf.destroy();
    return built;
  }

  function dress(entry: Entry, detail: SpriteDetail, zoom: number): void {
    if (textures === null) {
      return;
    }
    if (entry.spec.kind === 'candidate') {
      entry.sprite.texture = textures.candidate;
      // The staff's foot is the place, so the pennant flies above it.
      entry.sprite.anchor.set(0, 1);
      entry.sprite.scale.set(CANDIDATE_HEIGHT / TEXTURE.candidateHeight);
    } else if (detail === 'marker') {
      entry.sprite.texture = textures.marker;
      // The castle stands on the seat, so the sprite hangs from its own bottom edge.
      entry.sprite.anchor.set(0.5, 1);
      entry.sprite.scale.set(markerHeightForZoom(zoom) / TEXTURE.markerHeight);
    } else {
      entry.sprite.texture = textures.dot;
      entry.sprite.anchor.set(0.5, 0.5);
      entry.sprite.scale.set((DOT_RADIUS * 2) / TEXTURE.dotDiameter);
    }
  }

  function frame(): void {
    const zoom = camera.zoom();
    const detail = detailForZoom(zoom, everything);
    const { width, height } = camera.size();
    const view: CameraView = { center: camera.center(), zoom, width, height };
    const elapsed = performance.now() - started;

    // The shape only changes when the zoom crosses a threshold, so the texture is not reassigned per frame.
    const detailChanged = detail !== drawnDetail;
    drawnDetail = detail;

    for (const entry of entries.values()) {
      // A candidate is what the player is being asked about, so it is drawn however far back the
      // camera is; so is a house the player has asked to keep in sight. Everything else fades out with
      // the rest of the world's furniture.
      const spared = entry.spec.kind === 'candidate' || entry.spec.always === true;
      const shown = detailForMark(zoom, { everything, spared });
      if (shown === 'hidden') {
        entry.sprite.visible = false;
        continue;
      }

      const point = toScreen(entry.spec.at, view);
      if (!isWithinView(point, view)) {
        entry.sprite.visible = false;
        continue;
      }

      if (detailChanged || !entry.sprite.visible) {
        dress(entry, shown, zoom);
      } else if (shown === 'marker' && entry.spec.kind === 'house') {
        entry.sprite.scale.set(markerHeightForZoom(zoom) / TEXTURE.markerHeight);
      }

      const motion = idleMotionAt(elapsed, entry.phase);
      entry.sprite.visible = true;
      entry.sprite.x = point.x;
      entry.sprite.y = point.y - motion.lift;
      entry.sprite.rotation = shown === 'marker' && entry.spec.kind === 'house' ? motion.tilt : 0;
    }

    dressTheRing(zoom);
  }

  /** The ring sits on the ground under the selected house, so it does not bob with the mark above it. */
  function dressTheRing(zoom: number): void {
    if (ring === null) {
      return;
    }
    const on = selected === null ? undefined : entries.get(selected);
    // The mark's own detail, not the camera's: a house kept in sight is drawn where the rest are not,
    // and a selected one with no ring under it would look like a different thing entirely.
    const spared = on !== undefined && (on.spec.kind === 'candidate' || on.spec.always === true);
    const shown = detailForMark(zoom, { everything, spared });
    if (on === undefined || !on.sprite.visible || shown === 'hidden') {
      ring.visible = false;
      return;
    }
    // Wider than the mark it is under, or it would be a ring nobody can see behind a castle.
    const across = shown === 'marker' ? markerHeightForZoom(zoom) * 1.7 : DOT_RADIUS * 5;
    ring.visible = true;
    ring.scale.set(across / TEXTURE.ringDiameter);
    ring.x = on.sprite.x;
    ring.y = on.sprite.y;
  }

  return {
    async mount(container: HTMLElement): Promise<void> {
      await app.init({
        backgroundAlpha: 0,
        antialias: true,
        resizeTo: container,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      if (disposed) {
        app.destroy(true);
        return;
      }

      textures = buildTextures();
      // Under every sprite, because it marks the ground a house stands on rather than the house.
      ring = new Sprite(textures.ring);
      ring.anchor.set(0.5, 0.5);
      ring.tint = SELECTED;
      ring.visible = false;
      stage.addChild(ring);
      app.stage.addChild(stage);
      container.appendChild(app.canvas);
      started = performance.now();

      // Pixi drives this from its own animation frame, which the browser stops while the tab is hidden.
      //
      // The overlay therefore draws on a different frame from the map. Standing still, or dragged by hand,
      // the two agree exactly. During an animated camera flight the sprites can trail the ground by a few
      // pixels for the length of the flight, because each loop reads the camera at a slightly different
      // moment. The alternative is to draw the sprites inside the map's own render pass, which would force
      // the map to repaint at sixty frames a second forever, since the sprites are never quite still.
      app.ticker.add(frame);

      if (import.meta.env.DEV) {
        // Where every sprite actually ended up, for the console and for the end-to-end test, which has no
        // other way to ask a canvas what it drew.
        (window as unknown as { villagesSprites?: () => Record<string, DrawnSprite> }).villagesSprites = () =>
          Object.fromEntries(
            [...entries].map(([id, entry]) => [
              id,
              { x: entry.sprite.x, y: entry.sprite.y, visible: entry.sprite.visible },
            ]),
          );
      }
    },

    hitTest(point: { x: number; y: number }): string | null {
      let nearest: { id: string; away: number } | null = null;

      for (const [id, entry] of entries) {
        if (!entry.sprite.visible || entry.spec.kind !== 'house') {
          continue;
        }
        const box = entry.sprite.getBounds();
        if (point.x < box.minX || point.x > box.maxX || point.y < box.minY || point.y > box.maxY) {
          continue;
        }
        // Two marks can overlap where two houses are close. The nearer one is the one meant.
        const away = Math.hypot(point.x - entry.sprite.x, point.y - entry.sprite.y);
        if (nearest === null || away < nearest.away) {
          nearest = { id, away };
        }
      }

      return nearest?.id ?? null;
    },

    setSelected(id: string | null): void {
      selected = id;
    },

    setEverything(on: boolean): void {
      everything = on;
    },

    setSprites(sprites: readonly MapSprite[]): void {
      const seen = new Set<string>();

      for (const spec of sprites) {
        seen.add(spec.id);
        const existing = entries.get(spec.id);
        if (existing === undefined) {
          const sprite = new Sprite();
          sprite.visible = false;
          sprite.tint = spec.tint;
          stage.addChild(sprite);
          entries.set(spec.id, { spec, sprite, phase: phaseFor(spec.id) });
        } else {
          existing.spec = spec;
          existing.sprite.tint = spec.tint;
        }
      }

      for (const [id, entry] of entries) {
        if (!seen.has(id)) {
          entry.sprite.destroy();
          entries.delete(id);
        }
      }
    },

    destroy(): void {
      disposed = true;
      entries.clear();
      if (app.renderer !== null && app.renderer !== undefined) {
        app.destroy(true, { children: true });
      }
    },
  };
}
