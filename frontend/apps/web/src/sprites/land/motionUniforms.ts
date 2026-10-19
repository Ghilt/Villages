import { UniformGroup } from 'pixi.js';

import { carried, latticeNear } from '../clouds/cloudClock';

import { cropsTuningStore } from './cropsTuning';
import { grassTuningStore } from './grassTuning';
import { heathTuningStore } from './heathTuning';
import { iceTuningStore } from './iceTuning';
import { LAND_LOOK } from './look';
import { wetTuningStore } from './wetTuning';

/**
 * Each land motion's own uniforms, the ones its part of the land shader reads beside the land's: its sliders, and for
 * the crops' waves, the wet land's ripples and the drift where the wall clock has carried them, on lattices that come round with the
 * world's width as the gusts' does. Handed to the shader as resources of their own, set every frame by `tune`; a
 * slider moved asks for a frame through `watch`, so it shows even where nothing else moves the map.
 */
export interface MotionUniforms {
  groups: Record<string, UniformGroup>;
  tune(wall: number, still: boolean): void;
  watch(repaint: () => void): () => void;
}

const f32 = (value: number) => ({ value, type: 'f32' as const });
const vec2 = (x: number, y: number) => ({ value: new Float32Array([x, y]), type: 'vec2<f32>' as const });

/**
 * `duneShown` says where a page that shows one dune asks for it, in world units, every frame: the renders page's, so a
 * dune is there to see on its sand whatever the clumps make of it (`duneShader.ts`).
 */
export function createMotionUniforms(duneShown?: () => { x: number; y: number } | null): MotionUniforms {
  const grass = new UniformGroup({
    uPatch: f32(7),
    uRagged: f32(0),
    uSoft: f32(0),
    uMingle: f32(0),
    uBare: f32(0),
    uTall: f32(0),
    uBrush: f32(0),
    uTallHeight: f32(1),
    uBrushSize: f32(0.17),
    uDensity: f32(1),
    uGrassTrails: f32(1),
  });
  const crops = new UniformGroup({
    uFieldSize: f32(3.5),
    uFallow: f32(0),
    uRows: f32(0.4),
    uCropHeight: f32(0.3),
    uWaves: f32(0),
    uWaveLattice: vec2(16, 1),
    uWaveCarried: f32(0),
  });
  const heath = new UniformGroup({
    uHeathSize: f32(1),
    uHeathDensity: f32(1),
    uCotton: f32(0),
    uStir: f32(1),
    uHeathTrails: f32(1),
  });
  const wet = new UniformGroup({
    uMist: f32(0),
    uPools: f32(1),
    uRings: f32(0),
    uStems: f32(1),
    uRippleCarried: f32(0),
  });
  const ice = new UniformGroup({
    uGlints: f32(1),
    uSnow: f32(1),
    uSwirls: f32(1),
    uSand: f32(1),
    uDunes: f32(1),
    uDuneClumps: f32(1),
    uDuneShown: { value: new Float32Array(3), type: 'vec3<f32>' as const },
    uDriftLattice: vec2(3, 1),
    uDriftCarried: f32(0),
  });

  return {
    groups: {
      grassUniforms: grass,
      cropsUniforms: crops,
      heathUniforms: heath,
      wetUniforms: wet,
      iceUniforms: ice,
    },

    tune(wall, still) {
      const grassly = grassTuningStore.get();
      const g = grass.uniforms;
      g.uPatch = grassly.size;
      g.uRagged = grassly.ragged;
      g.uSoft = grassly.soft;
      g.uMingle = grassly.mingle;
      g.uBare = grassly.bare;
      g.uTall = grassly.tall;
      g.uBrush = grassly.brush;
      g.uTallHeight = grassly.tallHeight;
      g.uBrushSize = grassly.brushSize;
      g.uDensity = grassly.density;
      g.uGrassTrails = grassly.trails;
      grass.update();

      const cropsly = cropsTuningStore.get();
      const c = crops.uniforms;
      c.uFieldSize = cropsly.fieldSize;
      c.uFallow = cropsly.fallow;
      c.uRows = cropsly.rows;
      c.uCropHeight = cropsly.height;
      c.uWaves = cropsly.waves;
      const waves = latticeNear(cropsly.waveSize);
      c.uWaveLattice[0] = waves.cell;
      c.uWaveLattice[1] = waves.around;
      c.uWaveCarried = still ? 0 : carried(wall, LAND_LOOK.crops.waves.speed);
      crops.update();

      const heathly = heathTuningStore.get();
      const h = heath.uniforms;
      h.uHeathSize = heathly.size;
      h.uHeathDensity = heathly.density;
      h.uCotton = heathly.cotton;
      h.uStir = heathly.stir;
      h.uHeathTrails = heathly.trails;
      heath.update();

      const wetly = wetTuningStore.get();
      const w = wet.uniforms;
      w.uMist = wetly.mist;
      w.uPools = wetly.pools;
      w.uRings = wetly.rings;
      w.uStems = wetly.stems;
      w.uRippleCarried = still ? 0 : carried(wall, LAND_LOOK.wet.pools.rippleSpeed);
      wet.update();

      const icy = iceTuningStore.get();
      const i = ice.uniforms;
      i.uGlints = icy.glints;
      i.uSnow = icy.snow;
      i.uSwirls = icy.swirls;
      i.uSand = icy.sand;
      i.uDunes = icy.dunes;
      i.uDuneClumps = icy.clumps;
      const shown = duneShown?.() ?? null;
      i.uDuneShown[0] = shown?.x ?? 0;
      i.uDuneShown[1] = shown?.y ?? 0;
      i.uDuneShown[2] = shown === null ? 0 : 1;
      const streamers = latticeNear(LAND_LOOK.ice.drift.long);
      i.uDriftLattice[0] = streamers.cell;
      i.uDriftLattice[1] = streamers.around;
      i.uDriftCarried = still ? 0 : carried(wall, LAND_LOOK.ice.drift.speed);
      ice.update();
    },

    watch(repaint) {
      const stops = [
        grassTuningStore,
        cropsTuningStore,
        heathTuningStore,
        wetTuningStore,
        iceTuningStore,
      ].map((store) => store.watch(repaint));
      return () => stops.forEach((stop) => stop());
    },
  };
}
