import { shadersStore } from '../shaders/levels';
import { setTreesLevel, treesStore } from '../sprites/trees/treesMode';
import { resetTreesTuning, setTreesTuning, treesTuningStore } from '../sprites/trees/treesTuning';
import type { TreesTuning } from '../sprites/trees/treesTuning';
import { useStore } from '../store/useStore';
import { LevelSwitch } from './LevelSwitch';
import { Section } from './Section';
import { Sliders } from './Sliders';
import type { SliderDef } from './Sliders';

/**
 * The trees in the wind, a part of the Shaders section: its level in the bar, and on sliders how far a gust bends
 * the scenery and how much a crown pales as it passes. What each kind does of that is in `sprites/trees/look.ts`.
 */

const share = (value: number) => `${Math.round(value * 100)}%`;

const SLIDERS: readonly SliderDef<keyof TreesTuning>[] = [
  {
    key: 'bend',
    label: 'How far a gust bends them',
    min: 0,
    max: 0.4,
    step: 0.01,
    say: (value) => `${share(value)} of their height`,
  },
  { key: 'pale', label: 'How much a crown pales in a gust', min: 0, max: 0.6, step: 0.01, say: share },
];

/** What the part is, behind the question mark in its bar. */
const ABOUT =
  'Every tree, bush, reed and tuft of the scenery leans with the gusts the grass shows, its foot where it stands and its shadow with it, as far as its kind bends: a birch or a palm a lot, an oak a little, a boulder or a cactus not at all. The gusts are the same in every browser. Low is fifteen frames a second, high thirty; what a frame of the sprite canvas costs at each is said once in the log.';

export function TreesSection() {
  const level = useStore(treesStore, (state) => state.level);
  const on = useStore(shadersStore, (state) => state.on);
  const tuning = useStore(treesTuningStore);
  const tools = (
    <button
      type="button"
      className="debug__button"
      onClick={resetTreesTuning}
      title="put both trees sliders back where they started"
    >
      reset
    </button>
  );
  return (
    <Section
      name="Trees"
      about={ABOUT}
      tools={tools}
      control={<LevelSwitch level={level} onChange={setTreesLevel} overruled={!on} what="the trees" />}
    >
      <Sliders idPrefix="trees" sliders={SLIDERS} values={tuning} onChange={setTreesTuning} />
    </Section>
  );
}
