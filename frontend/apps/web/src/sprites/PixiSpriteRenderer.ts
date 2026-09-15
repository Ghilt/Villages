import { Application, Container, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';

import { isWithinView, toScreen } from './cameraMath';
import type { CameraView } from './cameraMath';
import { DOT_RADIUS, detailForZoom, idleMotionAt, markerHeightForZoom, phaseFor } from './spriteDetail';
import type { SpriteDetail } from './spriteDetail';
import type { CameraSource, MapSprite, SpriteRenderer } from './SpriteRenderer';

/** Both shapes are drawn once, larger than they are ever shown, and scaled down to stay crisp. */
const TEXTURE = {
  markerHeight: 96,
  markerWidth: 78,
  dotDiameter: 32,
  candidateHeight: 64,
  candidateWidth: 44,
} as const;

/** How tall a candidate's mark is drawn on the screen, whatever the camera is doing. */
const CANDIDATE_HEIGHT = 26;

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

  let textures: { marker: Texture; dot: Texture; candidate: Texture } | null = null;
  let drawnDetail: SpriteDetail | null = null;
  let started = 0;
  let disposed = false;

  function buildTextures(): { marker: Texture; dot: Texture; candidate: Texture } {
    const { markerWidth: w, markerHeight: h, dotDiameter: d } = TEXTURE;
    const shoulder = h * 0.52;

    // A shield, standing on its point, drawn in white so that a tint can colour it per house.
    const marker = new Graphics()
      .moveTo(2, 2)
      .lineTo(w - 2, 2)
      .lineTo(w - 2, shoulder)
      .quadraticCurveTo(w - 2, h - 8, w / 2, h - 2)
      .quadraticCurveTo(2, h - 8, 2, shoulder)
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

    const built = {
      marker: app.renderer.generateTexture(marker),
      dot: app.renderer.generateTexture(dot),
      candidate: app.renderer.generateTexture(candidate),
    };
    marker.destroy();
    dot.destroy();
    candidate.destroy();
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
      // The point of the shield is the seat, so the sprite hangs from its own bottom edge.
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
    const detail = detailForZoom(zoom);
    const { width, height } = camera.size();
    const view: CameraView = { center: camera.center(), zoom, width, height };
    const elapsed = performance.now() - started;

    // The shape only changes when the zoom crosses a threshold, so the texture is not reassigned per frame.
    const detailChanged = detail !== drawnDetail;
    drawnDetail = detail;

    for (const entry of entries.values()) {
      // A candidate is what the player is being asked about, so it is drawn however far back the
      // camera is; a house fades out with the rest of the world's furniture.
      if (detail === 'hidden' && entry.spec.kind !== 'candidate') {
        entry.sprite.visible = false;
        continue;
      }

      const point = toScreen(entry.spec.at, view);
      if (!isWithinView(point, view)) {
        entry.sprite.visible = false;
        continue;
      }

      if (detailChanged || !entry.sprite.visible) {
        dress(entry, detail, zoom);
      } else if (detail === 'marker' && entry.spec.kind === 'house') {
        entry.sprite.scale.set(markerHeightForZoom(zoom) / TEXTURE.markerHeight);
      }

      const motion = idleMotionAt(elapsed, entry.phase);
      entry.sprite.visible = true;
      entry.sprite.x = point.x;
      entry.sprite.y = point.y - motion.lift;
      entry.sprite.rotation = detail === 'marker' && entry.spec.kind === 'house' ? motion.tilt : 0;
    }
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
