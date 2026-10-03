import { resetRiverTuning, riverStore, setRiverTuning } from '../water/riverTuning';
import type { RiverTuning } from '../water/riverTuning';
import { useStore } from '../store/useStore';
import { Section } from './Section';

/**
 * WIP SPIKE: the rivers' look, on sliders, for Adam to play with. What each number means is in
 * `water/riverTuning.ts`; they change the water on the next frame, and are said in the log once a slider stops.
 * Only the realistic water and only rivers that flow, from zoom 8.5 in.
 */

interface Slider {
  key: keyof RiverTuning;
  label: string;
  min: number;
  max: number;
  step: number;
  /** The value as the line under the slider says it. */
  say: (value: number) => string;
}

const SLIDERS: readonly Slider[] = [
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

export function WaterSection() {
  const tuning = useStore(riverStore);
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
    <Section name="Water" tools={tools}>
      <p className="debug-map__note">
        The rivers’ own look, on the realistic water from zoom 8.5 in. Turn the fog of war off to see it
        clearly.
      </p>
      {SLIDERS.map((slider) => (
        <div key={slider.key}>
          <label className="debug-map__label" htmlFor={`water-${slider.key}`}>
            {slider.label}
          </label>
          <input
            id={`water-${slider.key}`}
            className="debug__slider"
            type="range"
            min={slider.min}
            max={slider.max}
            step={slider.step}
            value={tuning[slider.key]}
            onChange={(event) => setRiverTuning({ [slider.key]: Number(event.target.value) })}
          />
          <p className="debug-map__note">{slider.say(tuning[slider.key])}</p>
        </div>
      ))}
    </Section>
  );
}
