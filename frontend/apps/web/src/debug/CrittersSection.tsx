import { shadersStore } from '../shaders/levels';
import { critterReadingStore, critterStore, setCritterLevel } from '../sprites/critters/critterMode';
import type { CritterReading } from '../sprites/critters/critterMode';
import { critterTuningStore, resetCritterTuning, setCritterTuning } from '../sprites/critters/critterTuning';
import type { CritterTuning } from '../sprites/critters/critterTuning';
import { useStore } from '../store/useStore';
import { LevelSwitch } from './LevelSwitch';
import { Section } from './Section';
import { Sliders } from './Sliders';
import type { SliderDef } from './Sliders';

/**
 * The critters, a part of the Shaders section: their level in the bar beside what is flying now, and on sliders how
 * many there are and how big they are drawn. What each kind is and does is in `sprites/critters/look.ts` and
 * `casts.ts`. See decision record 0099.
 */

const SLIDERS: readonly SliderDef<keyof CritterTuning>[] = [
  {
    key: 'density',
    label: 'How many',
    min: 0,
    max: 1,
    step: 0.01,
    say: (value) => (value === 0 ? 'none' : `${Math.round(value * 100)}%`),
  },
  {
    key: 'often',
    label: 'How often, to look at them',
    min: 1,
    max: 20,
    step: 1,
    say: (value) => (value === 1 ? 'as often as a player sees them' : `${value} times as often`),
  },
  {
    key: 'size',
    label: 'How big',
    min: 0.5,
    max: 3,
    step: 0.05,
    say: (value) => `${value.toFixed(2)} times`,
  },
];

/** What is flying, said in a few words: `3 songbirds`, or why there are none. */
export function sayCritters({ flying, none }: CritterReading): string {
  if (none !== null) return none;
  const kinds = Object.entries(flying);
  return kinds.length === 0
    ? 'none flying'
    : kinds.map(([kind, count]) => `${count} ${kind}${count === 1 ? '' : 's'}`).join(', ');
}

/** What the part is, behind the question mark in its bar. */
const ABOUT =
  'Birds out of the trees and the bushes the scenery drew, from zoom 9 in, only where your house sees now, the same in every browser: a flock bursts out and scatters, or a bird or two flits to the next tree. Fewer is always some of the same ones, never others. Low moves them at fifteen frames a second and high at thirty. None for a player who asked for less motion.';

export function CrittersSection() {
  const level = useStore(critterStore, (state) => state.level);
  const on = useStore(shadersStore, (state) => state.on);
  const tuning = useStore(critterTuningStore);
  const reading = useStore(critterReadingStore);
  const tools = (
    <button
      type="button"
      className="debug__button"
      onClick={resetCritterTuning}
      title="put both critters sliders back where they started"
    >
      reset
    </button>
  );
  return (
    <Section
      name="Critters"
      about={ABOUT}
      tools={tools}
      reading={<span className="debug__quiet">{sayCritters(reading)}</span>}
      control={<LevelSwitch level={level} onChange={setCritterLevel} overruled={!on} what="the critters" />}
    >
      <Sliders idPrefix="critters" sliders={SLIDERS} values={tuning} onChange={setCritterTuning} />
    </Section>
  );
}
