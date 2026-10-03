import { shadersStore } from '../shaders/levels';
import { grassStore, setGrassLevel } from '../sprites/grass/grassMode';
import { useStore } from '../store/useStore';
import { LevelSwitch } from './LevelSwitch';
import { Section } from './Section';

/** WIP SPIKE: the grass, a part of the Shaders section. Its numbers are in `sprites/grass/look.ts` for now. */
export function GrassSection() {
  const level = useStore(grassStore, (state) => state.level);
  const on = useStore(shadersStore, (state) => state.on);
  return (
    <Section
      name="Grass"
      control={<LevelSwitch level={level} onChange={setGrassLevel} overruled={!on} what="the grass" />}
    >
      <p className="debug-map__note">
        Gusts and tufts on steppe, meadow, savanna and alpine meadow, from zoom 8.5 in. What a level costs the
        graphics card is said once in the log, the first time the grass is drawn at it.
      </p>
    </Section>
  );
}
