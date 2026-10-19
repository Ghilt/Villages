import type { ReactNode } from 'react';

import { shadersStore } from '../shaders/levels';
import { cropsTuningStore, resetCropsTuning, setCropsTuning } from '../sprites/land/cropsTuning';
import type { CropsTuning } from '../sprites/land/cropsTuning';
import { grassTuningStore, resetGrassTuning, setGrassTuning } from '../sprites/land/grassTuning';
import type { GrassTuning } from '../sprites/land/grassTuning';
import { heathTuningStore, resetHeathTuning, setHeathTuning } from '../sprites/land/heathTuning';
import type { HeathTuning } from '../sprites/land/heathTuning';
import { iceTuningStore, resetIceTuning, setIceTuning } from '../sprites/land/iceTuning';
import type { IceTuning } from '../sprites/land/iceTuning';
import { resetWetTuning, setWetTuning, wetTuningStore } from '../sprites/land/wetTuning';
import type { WetTuning } from '../sprites/land/wetTuning';
import type { DrawnMotion } from '../sprites/land/landMask';
import { landStore, setLandLevel, setLandShown } from '../sprites/land/landMode';
import { useStore } from '../store/useStore';
import { LevelSwitch } from './LevelSwitch';
import { Section } from './Section';
import { Sliders } from './Sliders';
import type { SliderDef } from './Sliders';

/**
 * The land, a part of the Shaders section: its level in the bar, and inside it a fold for each motion of the land,
 * each with its box, whether it is drawn, and its sliders. What moves on each kind of land is the table in
 * `sprites/land/look.ts`, and what each slider means is in `sprites/land/grassTuning.ts`, `cropsTuning.ts`, `heathTuning.ts`, `wetTuning.ts` and `iceTuning.ts`.
 */

const share = (value: number) => `${Math.round(value * 100)}%`;
const times = (value: number) => `${value.toFixed(2)} times`;
const units = (value: number) => `${value.toFixed(2)} world units`;

const GRASS_SLIDERS: readonly SliderDef<keyof GrassTuning>[] = [
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
  { key: 'trails', label: 'How many animal trails', min: 0, max: 2, step: 0.05, say: times },
];

const CROPS_SLIDERS: readonly SliderDef<keyof CropsTuning>[] = [
  { key: 'fieldSize', label: 'How big the fields are', min: 1, max: 10, step: 0.1, say: units },
  { key: 'fallow', label: 'How many fields lie fallow', min: 0, max: 0.6, step: 0.01, say: share },
  { key: 'rows', label: 'How far apart the rows are', min: 0.2, max: 0.8, step: 0.01, say: units },
  { key: 'height', label: 'How tall the crops stand', min: 0.1, max: 0.8, step: 0.01, say: units },
  { key: 'waveSize', label: 'How broad the waves are', min: 4, max: 40, step: 0.5, say: units },
  { key: 'waves', label: 'How strongly the waves show', min: 0, max: 0.6, step: 0.01, say: share },
];

const HEATH_SLIDERS: readonly SliderDef<keyof HeathTuning>[] = [
  { key: 'size', label: 'How big the clumps are', min: 0.5, max: 2, step: 0.05, say: times },
  { key: 'density', label: 'How thickly they grow', min: 0.1, max: 1, step: 0.01, say: share },
  { key: 'cotton', label: 'How much cotton grass on the tundra', min: 0, max: 1, step: 0.01, say: share },
  { key: 'stir', label: 'How much a gust stirs them', min: 0, max: 3, step: 0.05, say: times },
  { key: 'trails', label: 'How many animal trails', min: 0, max: 2, step: 0.05, say: times },
];

const WET_SLIDERS: readonly SliderDef<keyof WetTuning>[] = [
  { key: 'mist', label: 'How much mist', min: 0, max: 1, step: 0.01, say: share },
  { key: 'pools', label: 'How much open water', min: 0, max: 2, step: 0.05, say: times },
  { key: 'rings', label: 'How often a ring spreads', min: 0, max: 1, step: 0.01, say: share },
  { key: 'stems', label: 'How tall the reeds and shoots stand', min: 0, max: 1.5, step: 0.05, say: times },
];

const ICE_SLIDERS: readonly SliderDef<keyof IceTuning>[] = [
  { key: 'glints', label: 'How many glints flash on the salt', min: 0, max: 3, step: 0.05, say: times },
  { key: 'snow', label: 'How strongly the snow streams', min: 0, max: 2, step: 0.05, say: times },
  { key: 'swirls', label: 'How often the snow swirls', min: 0, max: 3, step: 0.05, say: times },
  {
    key: 'sand',
    label: 'How strongly the sand blows over the crests',
    min: 0,
    max: 2,
    step: 0.05,
    say: times,
  },
  { key: 'dunes', label: 'How high the dunes stand', min: 0, max: 2, step: 0.05, say: times },
  {
    key: 'clumps',
    label: 'How many clumps of dunes',
    min: 0,
    max: 3,
    step: 0.05,
    say: times,
  },
];

/** What the part is, behind the question mark in its bar. */
const ABOUT =
  'The land moving in the wind and the light, one layer for every kind of land, from zoom 8.5 in: the grass, the crops, the heath, the scrub and the tundra, the wet land, and the ice, the salt and the sand. Every other kind of land stands still on purpose: the water moves by a shader of its own, a wood by its trees, and bare stone not at all. What a level costs the graphics card is said once in the log, the first time the land is drawn at it.';

const GRASS_ABOUT =
  'Gusts, tufts, tall grass and brush on steppe, meadow, savanna and alpine meadow, bending in the one wind the trees bend in; and under the trees of the woods their undergrowth, sparser, shaded, with more low brush, sheltered from the gusts.';

const HEATH_ABOUT =
  'Low woody growth a gust only stirs, gentler than the grass: small purple clumps of heather close together, bigger grey-green bushes of scrub with bare ground between, the low mat of the tundra, and cotton grass nodding its white heads there.';

const WET_ABOUT =
  'Marsh, bog, paddy, floodplain, mangrove and swamp forest: open water among the growth catching the light, a ring spreading on it now and then, reeds in the marsh and shoots in rows in the paddy bending with the gusts, and mist lying low over the marsh and the bog, drifting down the wind.';

const ICE_ABOUT =
  'Points of light flashing for a moment and gone on the salt flats; snow streaming along the wind over the ice and the polar desert, with a little swirl of it now and then; and on the sand desert clumps of one, two or three dunes here and there, none touching another, still sand between them, long sweeping ridges, some bent as an S, and crescents, standing up as the trees do, lit and shaded by the one light, with sand streaming over their crests.';

const CROPS_ABOUT =
  'Farmland and farmland with woods cut into fields, each fallow, ripe or green, its crops standing in rows its own way, with long slow waves rolling through them down the wind, the same in every browser.';

export function LandSection() {
  const level = useStore(landStore, (state) => state.level);
  const on = useStore(shadersStore, (state) => state.on);
  const tuning = useStore(grassTuningStore);
  const crops = useStore(cropsTuningStore);
  const heath = useStore(heathTuningStore);
  const wet = useStore(wetTuningStore);
  const ice = useStore(iceTuningStore);
  return (
    <Section
      name="Land"
      about={ABOUT}
      control={<LevelSwitch level={level} onChange={setLandLevel} overruled={!on} what="the land" />}
    >
      <LandFold
        name="Grass"
        motion="grass"
        about={GRASS_ABOUT}
        reset={resetGrassTuning}
        resetTitle="put every grass slider back where it started"
      >
        <Sliders idPrefix="grass" sliders={GRASS_SLIDERS} values={tuning} onChange={setGrassTuning} />
      </LandFold>
      <LandFold
        name="Crops"
        motion="crops"
        about={CROPS_ABOUT}
        reset={resetCropsTuning}
        resetTitle="put every crops slider back where it started"
      >
        <Sliders idPrefix="crops" sliders={CROPS_SLIDERS} values={crops} onChange={setCropsTuning} />
      </LandFold>
      <LandFold
        name="Heath, scrub and tundra"
        motion="heath"
        about={HEATH_ABOUT}
        reset={resetHeathTuning}
        resetTitle="put every heath slider back where it started"
      >
        <Sliders idPrefix="heath" sliders={HEATH_SLIDERS} values={heath} onChange={setHeathTuning} />
      </LandFold>
      <LandFold
        name="Wet land"
        motion="wet"
        about={WET_ABOUT}
        reset={resetWetTuning}
        resetTitle="put every wet land slider back where it started"
      >
        <Sliders idPrefix="wet" sliders={WET_SLIDERS} values={wet} onChange={setWetTuning} />
      </LandFold>
      <LandFold
        name="Ice, salt and sand"
        motion="ice-salt-sand"
        about={ICE_ABOUT}
        reset={resetIceTuning}
        resetTitle="put every ice, salt and sand slider back where it started"
      >
        <Sliders idPrefix="ice" sliders={ICE_SLIDERS} values={ice} onChange={setIceTuning} />
      </LandFold>
    </Section>
  );
}

interface LandFoldProps {
  name: string;
  motion: DrawnMotion;
  about: string;
  reset: () => void;
  resetTitle: string;
  children: ReactNode;
}

/** One motion of the land: its box in the bar, whether it is drawn, and inside, its sliders with their reset. */
function LandFold({ name, motion, about, reset, resetTitle, children }: LandFoldProps) {
  const shown = useStore(landStore, (state) => state.shown[motion]);
  const control = (
    <label className="debug__check" title={`draw the ${name.toLowerCase()}, or leave that land as painted`}>
      <input
        type="checkbox"
        checked={shown}
        onChange={(event) => setLandShown(motion, event.target.checked)}
      />
      on
    </label>
  );
  const tools = (
    <button type="button" className="debug__button" onClick={reset} title={resetTitle}>
      reset
    </button>
  );
  return (
    <Section name={name} about={about} control={control} tools={tools}>
      {children}
    </Section>
  );
}
