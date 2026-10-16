import { shadersStore } from '../shaders/levels';
import { grassStore, setGrassLevel } from '../sprites/grass/grassMode';
import { grassTuningStore, resetGrassTuning, setGrassTuning } from '../sprites/grass/grassTuning';
import type { GrassTuning } from '../sprites/grass/grassTuning';
import { useStore } from '../store/useStore';
import { LevelSwitch } from './LevelSwitch';
import { Section } from './Section';
import { Sliders } from './Sliders';
import type { SliderDef } from './Sliders';

/**
 * WIP SPIKE: the grass, a part of the Shaders section: its level in the bar, and how it grows in patches on
 * sliders. What each number means is in `sprites/grass/grassTuning.ts`; the colours are in its `look.ts`.
 */

const share = (value: number) => `${Math.round(value * 100)}%`;
const units = (value: number) => `${value.toFixed(2)} world units`;

const SLIDERS: readonly SliderDef<keyof GrassTuning>[] = [
  { key: 'size', label: 'How big the patches are', min: 1, max: 30, step: 0.5, say: units },
  { key: 'ragged', label: 'How ragged their edges are', min: 0, max: 1, step: 0.01, say: share },
  {
    key: 'soft',
    label: 'How softly one kind gives way to the next',
    min: 0,
    max: 0.4,
    step: 0.01,
    say: (v) => v.toFixed(2),
  },
  {
    key: 'mingle',
    label: 'How much the kinds mingle outside their patches',
    min: 0,
    max: 0.6,
    step: 0.01,
    say: share,
  },
  { key: 'bare', label: 'How much ground is bare', min: 0, max: 1, step: 0.01, say: share },
  { key: 'tall', label: 'How much grass stands tall', min: 0, max: 1, step: 0.01, say: share },
  { key: 'brush', label: 'How much is brush', min: 0, max: 1, step: 0.01, say: share },
  {
    key: 'tallHeight',
    label: 'How tall the tall grass is',
    min: 1,
    max: 2.5,
    step: 0.05,
    say: (v) => `${v.toFixed(2)} times`,
  },
  { key: 'brushSize', label: 'How big a clump of brush is', min: 0.06, max: 0.4, step: 0.01, say: units },
  { key: 'density', label: 'How thickly the tufts grow', min: 0.1, max: 1, step: 0.01, say: share },
];

/** What the part is, behind the question mark in its bar. */
const ABOUT =
  'Gusts, tufts, tall grass and brush on steppe, meadow, savanna and alpine meadow, from zoom 8.5 in. What a level costs the graphics card is said once in the log, the first time the grass is drawn at it.';

export function GrassSection() {
  const level = useStore(grassStore, (state) => state.level);
  const on = useStore(shadersStore, (state) => state.on);
  const tuning = useStore(grassTuningStore);
  const tools = (
    <button
      type="button"
      className="debug__button"
      onClick={resetGrassTuning}
      title="put every grass slider back where it started"
    >
      reset
    </button>
  );
  return (
    <Section
      name="Grass"
      about={ABOUT}
      tools={tools}
      control={<LevelSwitch level={level} onChange={setGrassLevel} overruled={!on} what="the grass" />}
    >
      <Sliders idPrefix="grass" sliders={SLIDERS} values={tuning} onChange={setGrassTuning} />
    </Section>
  );
}
