import { RELIEF_METHODS, reliefStore, setReliefLevel, setReliefMethod, setReliefPixels } from '../map/relief';
import type { ReliefMethod } from '../map/relief';
import { shadersStore } from '../shaders/levels';
import type { ShaderLevel } from '../shaders/levels';
import { useStore } from '../store/useStore';
import { LevelSwitch } from './LevelSwitch';
import { Section } from './Section';

/**
 * The relief experiment (0016), a part of the Shaders section: the ground shaded by its slope, how strongly in
 * the bar, and inside it which way of shading and whether in pixels. What the levels mean is in `map/relief.ts`.
 */

const SAID: Record<ShaderLevel, string> = {
  off: 'not drawn, the ground as painted',
  low: 'faint',
  high: 'strong',
};

export function ReliefSection() {
  const level = useStore(reliefStore, (state) => state.level);
  const method = useStore(reliefStore, (state) => state.method);
  const pixels = useStore(reliefStore, (state) => state.pixels);
  const on = useStore(shadersStore, (state) => state.on);
  return (
    <Section
      name="Relief"
      control={
        <LevelSwitch level={level} onChange={setReliefLevel} overruled={!on} what="the relief" said={SAID} />
      }
    >
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
      <label
        className="debug__check"
        title="a block of shade for every height sample, for the plate renderer"
      >
        <input type="checkbox" checked={pixels} onChange={(event) => setReliefPixels(event.target.checked)} />
        pixels, a block of shade for every height sample, from about zoom 8 in
      </label>
      <p className="debug-map__note">
        Height from ETOPO 2022, 0 to 30 east and 30 to 60 north only: the Alps, the Apennines, the
        Carpathians, the Balkans. Lit from the upper right, as the shadows are. Real Earth, so wherever the
        master has moved the land the shading is off it.
      </p>
    </Section>
  );
}
