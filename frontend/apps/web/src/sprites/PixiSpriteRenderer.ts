import { Application, Container, Rectangle } from 'pixi.js';

import type { CameraView } from '../geometry/cameraMath';
import { revealedAt } from '../fog/fogField';
import type { FogField } from '../fog/fogField';
import { createUncolouring } from '../fog/uncolouring';
import { hangDevHandles } from './devHandles';
import { createCloudLayer } from './clouds/CloudLayer';
import { createCritterLayer } from './critters/CritterLayer';
import { createFogLayer } from './FogLayer';
import { createLandLayer } from './land/LandLayer';
import { soonest, type Layer } from './layer';
import { buildMarkTextures } from './markTextures';
import { watchStructureArt } from './structureAtlas';
import { createMarksLayer, type MarksLayer } from './MarksLayer';
import { createRingLayer, type RingLayer } from './RingLayer';
import { createSceneryDrawing } from './scenery/sceneryDrawing';
import { createSceneryLayer } from './scenery/SceneryLayer';
import type { CameraSource, FogHow, Scene, SpriteRenderer } from './SpriteRenderer';
import { createTreesLayer, type TreesLayer } from './trees/TreesLayer';
import { LONGEST_STEP_MS } from './twoForms';

/** What the dev server says when it has cut the art again, `vite/artApi.ts`. */
const ART_CUT = 'villages:art-cut';

/** Twelve frames a second: all a haze moving about a unit a second needs, and a fifth of what a display draws. */
const UNDULATION_MS = 83;

/** Nothing on the map yet: what the renderer holds until the first scene is handed it. */
const NOTHING: Scene = {
  sprites: [],
  selected: null,
  fog: null,
  scenery: { on: false, dial: 1, spacing: 1, laterBy: 0, shadows: 0, tilesRoot: '' },
};

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
 * **A stack of layers.** The scenery, the marks under the fog and over it, the fog with its haze's clock, the
 * ring, and the colour taken out of the map on a canvas of its own, each a \`Layer\` that draws its part of a
 * frame and says when it wants the next. The stack's order is the drawing's, bottom to top: the scenery and
 * the world outside vision, which lose their colour together on ground only revealed; the fog over them; the
 * clouds over the fog; the ring; and every sign the fog must not cover. See \`layer.ts\` and decisions 0062, 0098.
 */
export function createPixiSpriteRenderer(camera: CameraSource): SpriteRenderer {
  const app = new Application();
  const stage = new Container();
  /**
   * Everything under the fog, the scenery and the world outside vision, in one container so that one filter
   * takes its colour out where the house has only revealed. Its area is the screen, so the filter never
   * measures a layer of twenty thousand trees to find out how big it is. See decision record 0065.
   */
  const world = new Container();
  world.filterArea = new Rectangle(0, 0, 1, 1);
  const fog = createFogLayer();
  /** The colour taken out of the map, beneath this canvas; nothing until the page hands over a canvas. */
  let uncolouring: ReturnType<typeof createUncolouring> | null = null;
  let scenery: ReturnType<typeof createSceneryLayer> | null = null;
  /** The marks and the ring, once there is a canvas to draw them on; the scene waits for them until then. */
  let layers: { marks: MarksLayer; ring: RingLayer; trees: TreesLayer; drawn: readonly Layer[] } | null =
    null;
  /** What is on the map: the last scene handed in, which a renderer mounted late is given whole. */
  let scene: Scene = NOTHING;
  /**
   * The field the scenery was last told to grow by: undefined with the fog off, where everything grows, and
   * null for a house that sees nothing, where nothing does. Kept so the wood is only sorted again when the
   * fog changed, and not on every mark the gateway moves.
   */
  let groundField: FogField | null | undefined = undefined;
  const groundOf = (field: FogField | null | undefined): ((x: number, y: number) => boolean) | null =>
    field === undefined ? null : field === null ? () => false : (x, y) => revealedAt(field, x, y);

  let disposed = false;
  let unwatch: (() => void) | null = null;
  /** What the canvas was last sized to, so it is only resized when the map's box actually changed. */
  let canvasWas = { width: 0, height: 0 };
  /** When the last frame was drawn, so a trade moves on by real time rather than by frames. */
  let lastFrameAt = 0;
  /** A frame owed: asked for, and not yet drawn. The camera may not be moving, so nobody else will ask. */
  let owed: number | null = null;
  /**
   * The haze's slow clock: one frame at a time, twelve a second, while there is haze on the screen to move and
   * none otherwise; nothing else on the map has a clock of its own. Still for anyone who has asked for less
   * motion. See step 7 of docs/plans/fog-of-war.md.
   */
  let undulation: ReturnType<typeof setTimeout> | null = null;
  const stillHaze =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * Asks for one frame, however often it is asked before the frame comes: what every change here does - a
   * mark, the ring, the fog, the scenery - and a trade still running. The map may not be moving, so its
   * \`render\` may not be coming. A still map with nothing changing on it still draws nothing, and thirty
   * cells answered in one burst draw once rather than a frame a setter a cell.
   */
  function drawSoon(): void {
    if (owed !== null || disposed) {
      return;
    }
    owed = requestAnimationFrame(() => {
      owed = null;
      frame();
    });
  }

  /** Asks for a frame this many milliseconds from now: the haze's twelve a second. */
  function drawIn(ms: number): void {
    if (undulation !== null || disposed) {
      return;
    }
    undulation = setTimeout(() => {
      undulation = null;
      frame();
    }, ms);
  }

  function artCut(): void {
    scenery?.artChanged(drawSoon);
  }

  /** Stops reading the structures' atlas again when the dev server cuts it again. */
  let unpaint: (() => void) | null = null;

  /** The fog, and the haze's clock with it. */
  const hazeLayer: Layer = {
    draw(view: CameraView, now: number): number | null {
      fog.follow(view);
      if (stillHaze) {
        return null;
      }
      fog.setTime(now / 1000);
      return fog.undulates(view) ? UNDULATION_MS : null;
    },
    destroy: () => fog.destroy(),
  };

  /** The colour taken out of the map, on the canvas beneath this one. */
  const uncolouringLayer: Layer = {
    draw(view: CameraView): number | null {
      uncolouring?.follow(view);
      return null;
    },
    destroy: () => uncolouring?.destroy(),
  };

  /** The world's furniture, which asks for its own frames as the cells it cuts land. */
  const sceneryLayer = createSceneryDrawing(
    () => scenery,
    () => scene.scenery,
    drawSoon,
  );

  function frame(): void {
    if (layers === null || disposed) {
      return;
    }
    const { width, height } = camera.size();
    // The map's box can change without the window changing, and Pixi's own `resizeTo` listens to the
    // window alone. So the canvas is sized from the box the projection is about to use, not from a
    // resize event that may never come.
    if (width !== canvasWas.width || height !== canvasWas.height) {
      canvasWas = { width, height };
      app.renderer.resize(width, height);
      world.filterArea = new Rectangle(0, 0, width, height);
    }
    const view: CameraView = {
      center: camera.center(),
      zoom: camera.zoom(),
      width,
      height,
      pitch: camera.pitch(),
      bearing: camera.bearing(),
    };

    const now = performance.now();
    // Capped, because a still map draws nothing and the gap since the last frame is then seconds. A
    // house arriving on a still map would otherwise be handed the whole of its fade in one step.
    const elapsed = Math.min(now - lastFrameAt, LONGEST_STEP_MS);
    lastFrameAt = now;

    let wants: number | null = null;
    for (const layer of layers.drawn) {
      wants = soonest(wants, layer.draw(view, now, elapsed));
    }
    const measuring = layers.trees.measure();
    app.render();
    layers.trees.measured(measuring);

    if (wants === 0) {
      drawSoon();
    } else if (wants !== null) {
      drawIn(wants);
    }
  }

  /** The fog of war, and everything that follows from it: the scenery's ground, the colour out, the marks' sides. */
  function showFog(next: FogHow | null): void {
    fog.show(next === null ? null : { field: next.field });
    layers?.marks.setVision(next?.vision ?? null);
    const field = next === null ? undefined : next.field;
    if (field !== groundField) {
      groundField = field;
      scenery?.setGround(groundOf(field));
      // Only a house with revealed ground has any colour to take out, and the filter costs a pass.
      uncolouring?.show(field ?? null);
      world.filters = field === undefined || field === null ? null : [fog.uncolour];
    }
  }

  /** Hands the layers what changed between two scenes, or the whole of one to layers just made. */
  function apply(was: Scene | null, next: Scene): void {
    if (layers === null) {
      return;
    }
    // The fog first, so that a mark arriving with it is put on the right side of it.
    if (was === null || next.fog !== was.fog) {
      showFog(next.fog);
    }
    // A different scattering is a different world's worth of points, so what was cut is thrown away
    // rather than left to be a denser world's sparse half.
    if (
      was !== null &&
      (next.scenery.dial !== was.scenery.dial ||
        next.scenery.spacing !== was.scenery.spacing ||
        next.scenery.tilesRoot !== was.scenery.tilesRoot)
    ) {
      scenery?.clear();
    }
    if (was === null || next.sprites !== was.sprites) {
      layers.marks.setSprites(next.sprites);
    }
    if (was === null || next.selected !== was.selected) {
      layers.ring.setSelected(next.selected);
    }
  }

  return {
    async mount(container: HTMLElement, uncolourCanvas?: HTMLCanvasElement): Promise<void> {
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

      const textures = buildMarkTextures((shape) =>
        app.renderer.generateTexture({
          target: shape,
          textureSourceOptions: { autoGenerateMipmaps: true, scaleMode: 'linear' },
        }),
      );
      const marks = createMarksLayer(camera, textures);
      // The structures' pictures cut into an atlas, once they are read: until then, and without one, drawn in code.
      unpaint = watchStructureArt(textures.structures, () => {
        marks.setSprites(scene.sprites);
        drawSoon();
      });
      const ring = createRingLayer(textures, marks);
      // Under everything, because it is the ground the rest stands on; drawn bending in the wind by the trees' layer.
      const trees = createTreesLayer(app.renderer, drawSoon);
      scenery = createSceneryLayer(trees.shaders);
      scenery.setGround(groundOf(groundField));
      // The land moving in the wind and the light, on the ground under everything that stands on it.
      const land = createLandLayer(app.renderer, () => scene.scenery.tilesRoot, drawSoon);
      // The world outside vision over the scenery, both losing their colour on ground only revealed; then the
      // fog over them, and everything the fog must not cover above that.
      // The critters' shadows under the scenery, and the critters over it: only where the house sees now.
      const critters = createCritterLayer(drawSoon, () => ({ scenery: scene.scenery, sight: groundField }));
      world.addChild(land.sprite, critters.ground, scenery.container, critters.flying, marks.underTheFog);
      stage.addChild(world);
      // The clouds over the fog, and under the ring and every sign. See decision record 0098.
      const clouds = createCloudLayer(app.renderer, drawSoon, () => marks.iconsDrawn());
      stage.addChild(fog.mesh, clouds.sprite);
      if (uncolourCanvas !== undefined) {
        uncolouring = createUncolouring(uncolourCanvas);
        uncolouring.show(groundField ?? null);
      }
      world.filters = groundField === undefined || groundField === null ? null : [fog.uncolour];
      // The dev server cuts the art again whenever a picture in world/sprites/ is saved, and says so
      // here, so the new picture is on the map without a reload. See decision record 0059.
      import.meta.hot?.on(ART_CUT, artCut);
      stage.addChild(ring.ring);
      stage.addChild(marks.overIt);
      app.stage.addChild(stage);
      container.appendChild(app.canvas);

      // Drawn in the order the old frame drew them: the marks, the ring put where they were just drawn, the
      // fog, the colour taken out, and the scenery, then the wind it bends in; then the clouds, after the marks
      // they keep clear of.
      layers = {
        marks,
        ring,
        trees,
        drawn: [marks, ring, hazeLayer, uncolouringLayer, land, sceneryLayer, trees, critters, clouds],
      };
      // Whatever was handed over before the canvas was ready - the seats a founding choice offers always are,
      // since they arrive with the first frames - is given now, whole.
      apply(null, scene);

      // One clock. The map draws, then this draws, from the camera the map just used, into the same
      // browser frame. Drawing on an animation frame of its own read the camera at a different instant,
      // so the marks trailed the ground for the length of every flight - which the comment that used to
      // stand here admitted, and accepted because the marks were never quite still. They are still now.
      lastFrameAt = performance.now();
      unwatch = camera.watch(frame);
      frame();

      hangDevHandles({
        fog: () => fog.report(),
        marksInVision: () => layers?.marks.inVision() ?? 0,
        undulating: () => undulation !== null,
        sprites: () => layers?.marks.report() ?? {},
      });
    },

    hitTest(point: { x: number; y: number }): string | null {
      return layers?.marks.hitTest(point) ?? null;
    },

    groupOf(leader: string): readonly string[] {
      return layers?.marks.groupOf(leader) ?? [];
    },

    setScene(next: Scene): void {
      const was = scene;
      scene = next;
      // Before the canvas is ready this only keeps it: the layers are given the whole of it when they are made.
      apply(was, next);
      drawSoon();
    },

    destroy(): void {
      disposed = true;
      if (undulation !== null) {
        clearTimeout(undulation);
        undulation = null;
      }
      for (const layer of layers?.drawn ?? [hazeLayer]) {
        layer.destroy();
      }
      import.meta.hot?.off(ART_CUT, artCut);
      unpaint?.();
      scenery = null;
      unwatch?.();
      unwatch = null;
      if (owed !== null) {
        cancelAnimationFrame(owed);
        owed = null;
      }
      layers = null;
      if (app.renderer !== null && app.renderer !== undefined) {
        app.destroy(true, { children: true });
      }
    },
  };
}
