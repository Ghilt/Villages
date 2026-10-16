import { resetRiverTuning, riverStore, setRiverTuning } from '../water/riverTuning';
import type { RiverTuning } from '../water/riverTuning';
import { setWaterLevel, setWaterLook, waterStore } from '../water/waterMode';
import type { WaterLook } from '../water/waterMode';
import { useStore } from '../store/useStore';
import { shadersStore } from '../shaders/levels';
import { LevelSwitch } from './LevelSwitch';
import { Section } from './Section';
import { Sliders } from './Sliders';
import type { SliderDef } from './Sliders';

/**
 * The water, a part of the Shaders section: whether it is drawn, in which look, and the rivers' look on sliders,
 * for Adam's eye. What each number means is in
 * `water/riverTuning.ts`; they change the water on the next frame, and are said in the log once a slider stops.
 * Only the realistic water and only rivers that flow, from zoom 8.5 in.
 */

const SLIDERS: readonly SliderDef<keyof RiverTuning>[] = [
  {
    key: 'speed',
    label: 'How fast the water runs',
    min: 0,
    max: 4,
    step: 0.05,
    say: (v) => `${v.toFixed(2)} times`,
  },
  {
    key: 'spacing',
    label: 'How far apart the ripples are',
    min: 0.5,
    max: 8,
    step: 0.1,
    say: (v) => `${v.toFixed(1)} world units`,
  },
  {
    key: 'bow',
    label: 'How far the middle runs ahead',
    min: 0,
    max: 4,
    step: 0.05,
    say: (v) => (v === 0 ? 'straight across' : `${v.toFixed(2)} world units`),
  },
  {
    key: 'sharpness',
    label: 'How thin the crests are',
    min: 1,
    max: 30,
    step: 0.5,
    say: (v) => v.toFixed(1),
  },
  {
    key: 'ripples',
    label: 'How bright the ripples are',
    min: 0,
    max: 1,
    step: 0.01,
    say: (v) => v.toFixed(2),
  },
  {
    key: 'specks',
    label: 'How bright the specks on the current are',
    min: 0,
    max: 1,
    step: 0.01,
    say: (v) => v.toFixed(2),
  },
  {
    key: 'waves',
    label: 'How much of the sea’s waves rivers keep',
    min: 0,
    max: 1,
    step: 0.01,
    say: (v) => v.toFixed(2),
  },
  {
    key: 'caustics',
    label: 'How much of the sea’s caustics rivers keep',
    min: 0,
    max: 1,
    step: 0.01,
    say: (v) => v.toFixed(2),
  },
];

/** What the part is, behind the question mark in its bar. */
const ABOUT =
  'From zoom 8.5 in. The sliders are the rivers’ own look, on the realistic water. Turn the fog of war off to see it clearly.';

export function WaterSection() {
  const tuning = useStore(riverStore);
  const level = useStore(waterStore, (state) => state.level);
  const on = useStore(shadersStore, (state) => state.on);
  const look = useStore(waterStore, (state) => state.look);
  const tools = (
    <button
      type="button"
      className="debug__button"
      onClick={resetRiverTuning}
      title="put every river slider back where it started"
    >
      reset
    </button>
  );
  return (
    <Section
      name="Water"
      about={ABOUT}
      tools={tools}
      control={<LevelSwitch level={level} onChange={setWaterLevel} overruled={!on} what="the water" />}
    >
      <label className="debug-map__label" htmlFor="water-look">
        Look
      </label>
      <select
        id="water-look"
        className="debug-map__select"
        value={look}
        onChange={(event) => setWaterLook(event.target.value as WaterLook)}
      >
        <option value="realistic">Realistic</option>
        <option value="wavelets">Wavelets, its first look</option>
      </select>
      <Sliders idPrefix="water" sliders={SLIDERS} values={tuning} onChange={setRiverTuning} />
    </Section>
  );
}
