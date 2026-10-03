import { setShadersOn, shadersStore } from '../shaders/levels';
import { useStore } from '../store/useStore';
import { GrassSection } from './GrassSection';
import { Section } from './Section';
import { WaterSection } from './WaterSection';

/**
 * The shaders the map is drawn with that are a look and nothing more: each a part of its own that folds on its
 * own, with off, low and high in its bar, and in this section's bar the one box that turns them all off and on
 * again at the levels they had.
 */
export function ShadersSection() {
  const on = useStore(shadersStore, (state) => state.on);
  const control = (
    <label className="debug__check" title="draw the map's shaders, each at its own level, or none of them">
      <input type="checkbox" checked={on} onChange={(event) => setShadersOn(event.target.checked)} />
      on
    </label>
  );
  return (
    <Section name="Shaders" control={control}>
      <WaterSection />
      <GrassSection />
    </Section>
  );
}
