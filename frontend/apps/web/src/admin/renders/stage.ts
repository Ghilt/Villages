import { Application, Sprite, Texture } from 'pixi.js';

import { fromMercator, pixelsPerWorldUnit } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { terrainPalette } from '../../geometry/terrainClasses';
import { TILE, WORLD_MASTER_WIDTH } from '../../geometry/world';
import { createCritterLayer } from '../../sprites/critters/CritterLayer';
import { askSpawn } from '../../sprites/critters/critterSpawn';
import type { Ground } from '../../sprites/critters/types';
import { createLandLayer } from '../../sprites/land/LandLayer';
import { soonest } from '../../sprites/layer';
import { createTreesLayer } from '../../sprites/trees/TreesLayer';
import { LONGEST_STEP_MS } from '../../sprites/twoForms';

import { paintSquares } from './paint';
import { rendersScenery } from './scenery';
import { SQUARE, ZOOM, classAtOf, paintedClassAtOf, squareAtOf } from './squares';
import type { RendersLayout } from './squares';

/**
 * The renders page's canvas: the map's own layers over the page's own world - the land, the trees in the wind and the
 * critters - with the paint under them, drawn from one camera that never moves, at one zoom. The water's motion is the
 * map's own layer and the clouds the sky's, so neither is here.
 */

/** The room round the squares, in world units, so nothing at the edge is cut off. */
export const MARGIN = 1;

/** Where the canvas is in the page's world: its north-west corner, how many pixels a world unit is, and its size. */
export function boardOf(layout: RendersLayout): {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
} {
  const scale = pixelsPerWorldUnit(ZOOM);
  return {
    x: layout.from.x - MARGIN,
    y: layout.from.y - MARGIN,
    scale,
    width: Math.ceil((layout.to.x - layout.from.x + 2 * MARGIN) * scale),
    height: Math.ceil((layout.to.y - layout.from.y + 2 * MARGIN) * scale),
  };
}

export interface RendersStage {
  stop(): void;
}

export async function startRenders(
  host: HTMLElement,
  layout: RendersLayout,
  tilesRoot: string,
  painted: () => void,
): Promise<RendersStage> {
  const board = boardOf(layout);
  const view: CameraView = {
    center: fromMercator({
      x: (board.x + board.width / board.scale / 2) / WORLD_MASTER_WIDTH,
      y: (board.y + board.height / board.scale / 2) / WORLD_MASTER_WIDTH,
    }),
    zoom: ZOOM,
    width: board.width,
    height: board.height,
  };
  let stopped = false;
  const app = new Application();
  await app.init({
    width: board.width,
    height: board.height,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio,
    autoDensity: true,
    autoStart: false,
  });
  host.replaceChildren(app.canvas);

  const classAt = classAtOf(layout);
  const squareAt = squareAtOf(layout);
  const inside = (x: number, y: number) => squareAt(x, y) !== null;
  const names: string[] = [];
  for (const one of (await terrainPalette()).classes) names[one.id] = one.name;

  // On a timer rather than an animation frame: a page in the background is given no animation frames, and its
  // timers are slowed by the browser instead, which still draws it now and then.
  let timer: ReturnType<typeof setTimeout> | null = null;
  const drawIn = (ms: number) => {
    if (stopped || timer !== null) return;
    timer = setTimeout(frame, ms);
  };
  const repaint = () => drawIn(0);

  // The page's world, a flat tile at a time, for the land layer to read as it reads the map's.
  const tilesOf = (_root: string, tileX: number, tileY: number) => {
    const tile = new Uint8Array(TILE * TILE);
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) tile[y * TILE + x] = classAt(tileX * TILE + x, tileY * TILE + y);
    }
    return Promise.resolve(tile);
  };
  const land = createLandLayer(app.renderer, () => 'renders', repaint, tilesOf);
  const trees = createTreesLayer(app.renderer, repaint);
  const scenery = await rendersScenery(tilesRoot, layout, trees.shaders);
  const ground: Ground = {
    coverIn: (fromX, fromY, toX, toY) =>
      scenery.cover.filter((one) => one.x >= fromX && one.x < toX && one.y >= fromY && one.y < toY),
    classAt: (x, y) => names[classAt(Math.floor(x), Math.floor(y))] ?? null,
    sees: () => true,
  };
  const critters = createCritterLayer(
    repaint,
    () => ({ scenery: { on: true, tilesRoot, dial: 1, spacing: 1 }, sight: undefined }),
    ground,
  );
  const paint = new Sprite(Texture.EMPTY);
  app.stage.addChild(paint, land.sprite, critters.ground, scenery.container, critters.flying);

  let lastAt = performance.now();
  function frame(): void {
    timer = null;
    if (stopped) return;
    const now = performance.now();
    const elapsed = Math.min(LONGEST_STEP_MS, now - lastAt);
    lastAt = now;
    scenery.place(view);
    let wants: number | null = null;
    for (const layer of [land, trees, critters]) wants = soonest(wants, layer.draw(view, now, elapsed));
    const measuring = trees.measure();
    app.render();
    trees.measured(measuring);
    drawIn(wants ?? 250);
  }
  repaint();

  // A critter of each kind put in the middle of its square now and again, so each is always about to be seen.
  const spawning = layout.critters.map((square) => {
    const put = () => askSpawn(square.x + SQUARE / 2, square.y + SQUARE / 2, square.critter!.kind);
    put();
    return setInterval(put, square.critter!.every * 1000);
  });

  void paintSquares(view, paintedClassAtOf(layout), inside, () => stopped).then((canvas) => {
    if (canvas === null || stopped) return;
    paint.texture = Texture.from(canvas);
    paint.width = board.width;
    paint.height = board.height;
    painted();
    repaint();
  });

  return {
    stop() {
      stopped = true;
      spawning.forEach(clearInterval);
      if (timer !== null) clearTimeout(timer);
      for (const layer of [land, trees, critters]) layer.destroy();
      scenery.destroy();
      app.destroy(true, { children: true });
    },
  };
}
