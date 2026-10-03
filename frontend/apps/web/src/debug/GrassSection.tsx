import { grassStore, setGrassEnabled } from '../sprites/grass/grassMode';
import { useStore } from '../store/useStore';
import { EnabledBox } from './EnabledBox';
import { Section } from './Section';

/** WIP SPIKE: the grass, a part of the Shaders section. Its numbers are in `sprites/grass/look.ts` for now. */
export function GrassSection() {
  const enabled = useStore(grassStore, (state) => state.enabled);
  return (
    <Section name="Grass">
      <EnabledBox
        checked={enabled}
        onChange={setGrassEnabled}
        title="let the grass sway in the wind in this window, or leave the grassland as painted"
      />
      <p className="debug-map__note">
        Gusts and tufts on steppe, meadow, savanna and alpine meadow, from zoom 8.5 in. What it costs the
        graphics card is said once in the log.
      </p>
    </Section>
  );
}
