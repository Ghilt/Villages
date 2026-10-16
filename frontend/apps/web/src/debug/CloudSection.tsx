import { shadersStore } from '../shaders/levels';
import { cloudReadingStore, cloudStore, setCloudLevel } from '../sprites/clouds/cloudMode';
import type { CloudReading } from '../sprites/clouds/cloudMode';
import { cloudTuningStore, resetCloudTuning, setCloudTuning } from '../sprites/clouds/cloudTuning';
import type { CloudTuning } from '../sprites/clouds/cloudTuning';
import { useStore } from '../store/useStore';
import { LevelSwitch } from './LevelSwitch';
import { Section } from './Section';
import { Sliders } from './Sliders';
import type { SliderDef } from './Sliders';

/**
 * The clouds, a part of the Shaders section: their level in the bar beside what they are drawing at the camera's
 * zoom, and the numbers that are a matter of taste on sliders. What each number means is in
 * `sprites/clouds/cloudTuning.ts`; the rest of their look is in its `look.ts`. See decision record 0098.
 */

const share = (value: number) => `${Math.round(value * 100)}%`;
const zoom = (value: number) => `zoom ${value.toFixed(2)}`;

const SLIDERS: readonly SliderDef<keyof CloudTuning>[] = [
  { key: 'cover', label: 'How much of the sky is cloud', min: 0, max: 1, step: 0.01, say: share },
  {
    key: 'size',
    label: 'How big the clumps are',
    min: 60,
    max: 900,
    step: 10,
    say: (v) => `${Math.round(v)} world units`,
  },
  {
    key: 'speed',
    label: 'How fast the wind carries them',
    min: 0,
    max: 60,
    step: 0.5,
    say: (v) => `${v.toFixed(1)} world units a second`,
  },
  {
    key: 'change',
    label: 'How fast they change shape',
    min: 0,
    max: 1.5,
    step: 0.05,
    say: (v) => (v === 0 ? 'not at all' : `their detail drifts ${Math.round(v * 100)}% faster`),
  },
  { key: 'patches', label: 'How much they gather in patches', min: 0, max: 1, step: 0.01, say: share },
  {
    key: 'edge',
    label: 'How soft their edges are',
    min: 0.005,
    max: 0.2,
    step: 0.005,
    say: (v) => v.toFixed(3),
  },
  { key: 'shadow', label: 'How dark their shadows are', min: 0, max: 1, step: 0.01, say: share },
  {
    key: 'reach',
    label: 'How far from them their shadows fall',
    min: 0,
    max: 2,
    step: 0.05,
    say: (v) => `${v.toFixed(2)} of a clump`,
  },
  {
    key: 'clearing',
    label: 'How far round a mark they keep clear',
    min: 0,
    max: 120,
    step: 2,
    say: (v) => `${Math.round(v)} pixels`,
  },
  { key: 'inFrom', label: 'Under the clouds closer in than', min: 5, max: 9, step: 0.05, say: zoom },
  { key: 'overFrom', label: 'Over the clouds from', min: 4, max: 8, step: 0.05, say: zoom },
  { key: 'fadeFrom', label: 'Fading from', min: 3, max: 7, step: 0.05, say: zoom },
  { key: 'goneAt', label: 'Gone at', min: 2, max: 6, step: 0.05, say: zoom },
];

const BANDS: Record<CloudReading['band'], string> = {
  under: 'under the clouds',
  in: 'in the clouds',
  over: 'over the clouds',
  fading: 'fading',
  gone: 'gone',
};

function sayReading({ band, share }: CloudReading): string {
  return band === 'under' || band === 'gone' ? BANDS[band] : `${BANDS[band]}, ${share}%`;
}

export function CloudSection() {
  const level = useStore(cloudStore, (state) => state.level);
  const on = useStore(shadersStore, (state) => state.on);
  const tuning = useStore(cloudTuningStore);
  const reading = useStore(cloudReadingStore);
  const tools = (
    <button
      type="button"
      className="debug__button"
      onClick={resetCloudTuning}
      title="put every cloud slider back where it started"
    >
      reset
    </button>
  );
  return (
    <Section
      name="Clouds"
      tools={tools}
      reading={<span className="debug__quiet">{sayReading(reading)}</span>}
      control={<LevelSwitch level={level} onChange={setCloudLevel} overruled={!on} what="the clouds" />}
    >
      <p className="debug-map__note">
        Clouds over the world from zoom 7 out, gone further out, over the fog's haze and under every sign, the
        same sky in every browser while the sliders are where they started. What a level costs the graphics
        card is said once in the log, the first time the clouds are drawn at it.
      </p>
      <Sliders idPrefix="clouds" sliders={SLIDERS} values={tuning} onChange={setCloudTuning} />
    </Section>
  );
}
