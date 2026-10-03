import { GrassSection } from './GrassSection';
import { Section } from './Section';
import { WaterSection } from './WaterSection';

/**
 * The shaders the map is drawn with that are a look and nothing more: each a part of its own that folds on its
 * own, opening with a box that turns it off for this window, and holding whatever else tunes it.
 */
export function ShadersSection() {
  return (
    <Section name="Shaders">
      <WaterSection />
      <GrassSection />
    </Section>
  );
}
