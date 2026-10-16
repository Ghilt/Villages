import {
  RELIEF_METHODS,
  reliefStore,
  setReliefDrawer,
  setReliefLevel,
  setReliefMethod,
  setReliefPixels,
} from '../map/relief';
import type { ReliefDrawer, ReliefMethod } from '../map/relief';
import { reliefTuningStore, resetReliefTuning, setReliefTuning } from '../map/reliefTuning';
import type { ReliefTuning } from '../map/reliefTuning';
import { shadersStore } from '../shaders/levels';
import type { ShaderLevel } from '../shaders/levels';
import { useStore } from '../store/useStore';
import { LevelSwitch } from './LevelSwitch';
import { Section } from './Section';
import { Sliders } from './Sliders';
import type { SliderDef } from './Sliders';

/**
 * The relief, a part of the Shaders section: the ground shaded by its slope, how strongly in the bar, and inside
 * it how strongly at each zoom, which shader draws it, whether in pixels, and each one's own levers. What the
 * levels mean is in `map/relief.ts`, and what each number means in `map/reliefTuning.ts`. Decision record 0090.
 */

const SAID: Record<ShaderLevel, string> = {
  off: 'not drawn, the ground as painted',
  low: 'faint',
  high: 'strong',
};

const share = (value: number) => `${Math.round(value * 100)}%`;
const atZoom = (value: number) => `zoom ${value.toFixed(2)}`;

const BY_ZOOM: readonly SliderDef<keyof ReliefTuning>[] = [
  { key: 'far', label: 'How strong far out', min: 0, max: 1.5, step: 0.05, say: share },
  { key: 'from', label: 'Far out reaches in to', min: 0, max: 10, step: 0.25, say: atZoom },
  { key: 'near', label: 'How strong close in', min: 0, max: 1.5, step: 0.05, say: share },
  { key: 'to', label: 'Close in starts at', min: 0, max: 10, step: 0.25, say: atZoom },
];

const OURS: readonly SliderDef<keyof ReliefTuning>[] = [
  {
    key: 'steepness',
    label: 'How steep the ground is shaded as',
    min: 0.25,
    max: 4,
    step: 0.05,
    say: (value) => `${value.toFixed(2)} times`,
  },
  {
    key: 'tones',
    label: 'Hard tones each side of flat',
    min: 0,
    max: 6,
    step: 1,
    say: (value) => (value === 0 ? 'as they come' : String(value)),
  },
];

/** What the part is, behind the question mark in its bar. */
const ABOUT =
  'The ground shaded by its slope, the whole world, lit from the upper right as the shadows are. Heavy far out and light close in unless the sliders say otherwise; they are remembered in this browser, and said in the log once one stops.';

export function ReliefSection() {
  const level = useStore(reliefStore, (state) => state.level);
  const drawnBy = useStore(reliefStore, (state) => state.drawnBy);
  const method = useStore(reliefStore, (state) => state.method);
  const pixels = useStore(reliefStore, (state) => state.pixels);
  const tuning = useStore(reliefTuningStore);
  const on = useStore(shadersStore, (state) => state.on);
  const tools = (
    <button
      type="button"
      className="debug__button"
      onClick={resetReliefTuning}
      title="put every relief slider back where it started"
    >
      reset
    </button>
  );
  return (
    <Section
      name="Relief"
      about={ABOUT}
      tools={tools}
      control={
        <LevelSwitch level={level} onChange={setReliefLevel} overruled={!on} what="the relief" said={SAID} />
      }
    >
      <Sliders idPrefix="relief" sliders={BY_ZOOM} values={tuning} onChange={setReliefTuning} />
      <label className="debug-map__label" htmlFor="relief-drawer">
        Drawn by
      </label>
      <select
        id="relief-drawer"
        className="debug-map__select"
        value={drawnBy}
        onChange={(event) => setReliefDrawer(event.target.value as ReliefDrawer)}
      >
        <option value="ours">our shader: pixels on the lattice&apos;s diamonds, no seam</option>
        <option value="maplibre">MapLibre&apos;s hillshade: square pixels, a seam close in</option>
      </select>
      <label className="debug__check" title="hard cells of shade rather than shade blended across the ground">
        <input type="checkbox" checked={pixels} onChange={(event) => setReliefPixels(event.target.checked)} />
        pixels, a cell of shade at a time, from about zoom 8 in
      </label>
      {drawnBy === 'ours' ? (
        <Sliders idPrefix="relief" sliders={OURS} values={tuning} onChange={setReliefTuning} />
      ) : (
        <>
          <label className="debug-map__label" htmlFor="relief-method">
            Shading
          </label>
          <select
            id="relief-method"
            className="debug-map__select"
            value={method}
            onChange={(event) => setReliefMethod(event.target.value as ReliefMethod)}
          >
            {RELIEF_METHODS.map((one) => (
              <option key={one.name} value={one.name}>
                {one.name}: {one.note}
              </option>
            ))}
          </select>
        </>
      )}
    </Section>
  );
}
