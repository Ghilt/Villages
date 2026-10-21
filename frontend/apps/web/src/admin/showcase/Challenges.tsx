import { useState } from 'react';

import { Slider } from '../../ui/slider/Slider';
import { SliceChip, SliceOpened, SliceTray } from '../../ui/slice/Slice';
import type { AspectShown, EffectShown } from '../../ui/slice/Slice';
import type { Borne, SliceState } from '../../ui/slice/sliceWords';
import { HappeningPlate, TugBar } from '../../ui/tug/Tug';
import type { SideShown } from '../../ui/tug/Tug';
import { towardSaid } from '../../ui/tug/tugShare';
import { Part, Specimen, Specimens } from './Specimen';

/** Four of the ten aspects, as a slice shows them. */
const HOLY: AspectShown = { mark: 'aspect-holy', name: 'Holy', colour: 'var(--ui-aspect-holy)' };
const REASON: AspectShown = { mark: 'aspect-reason', name: 'Reason', colour: 'var(--ui-aspect-reason)' };
const DIPLOMACY: AspectShown = {
  mark: 'aspect-diplomacy',
  name: 'Diplomacy',
  colour: 'var(--ui-aspect-diplomacy)',
};
const AUTHORITY: AspectShown = {
  mark: 'aspect-authority',
  name: 'Authority',
  colour: 'var(--ui-aspect-authority)',
};
const VIOLENCE: AspectShown = {
  mark: 'aspect-violence',
  name: 'Violence',
  colour: 'var(--ui-aspect-violence)',
};
const INDUSTRY: AspectShown = {
  mark: 'aspect-industry',
  name: 'Industry',
  colour: 'var(--ui-aspect-industry)',
};

const EMPOWERED: Borne = { name: 'Empowered', kind: 'buff', seconds: null };
const WEAKENED: Borne = { name: 'Weakened', kind: 'debuff', seconds: 3 };
const HASTENED: Borne = { name: 'Hastened', kind: 'buff', seconds: 6 };

/** A chip in each state, as a sermon's happening of Holy finds a house's slices. */
const STATES: readonly {
  readonly state: SliceState;
  readonly aspect: AspectShown;
  readonly said?: string;
  readonly borne: readonly Borne[];
  readonly note: string;
}[] = [
  {
    state: 'matching',
    aspect: HOLY,
    said: 'matches, ×1.5',
    borne: [EMPOWERED],
    note: 'its aspect is the happening’s',
  },
  {
    state: 'answering',
    aspect: REASON,
    borne: [],
    note: 'its anti-aspect is, and it carries an effect for that',
  },
  { state: 'working', aspect: DIPLOMACY, borne: [], note: 'something it carries works in any happening' },
  { state: 'idle', aspect: AUTHORITY, borne: [], note: 'nothing it carries can work now' },
];

const REASONS_EFFECTS: readonly EffectShown[] = [
  {
    name: 'Learned Counsel',
    need: 'any',
    works: true,
    now: 'working',
    words: 'Master Oswin lends his reason as it meets a happening',
  },
  {
    name: 'Sow Doubt',
    need: 'anti',
    works: true,
    now: 'working',
    words: 'Weakens every enemy summon for 12 s',
  },
];

const HOLYS_EFFECTS: readonly EffectShown[] = [
  { name: 'Ordination', need: 'match', works: false, now: 'waits for Holy', words: 'Summons a Priest' },
  {
    name: 'Sanctuary',
    need: 'match',
    works: false,
    now: 'waits for Holy',
    words: 'Puts the Cathedral of Varga on the line',
  },
];

const VARGA = '#3d6aa6';
const BRANNOCK = '#a8452a';
const VARGA_SIDE: SideShown = { name: 'Varga', colour: VARGA };
const BRANNOCK_SIDE: SideShown = { name: 'Brannock', colour: BRANNOCK };

/** The tug held here, dragged by a slider under it. */
function LiveTug() {
  const [tug, setTug] = useState(28.3);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 'min(560px, 100%)' }}>
      <TugBar
        first={VARGA_SIDE}
        second={BRANNOCK_SIDE}
        tug={tug}
        said={towardSaid(tug, 'Varga', 'Brannock')}
      />
      <Slider value={tug} min={-100} max={100} step={0.5} onChange={setTug} label="The tug" />
    </div>
  );
}

/** A house's tray, held here: folded and opened, and a chip pressed to open its slice. */
function LiveTray({ direction, align }: { direction: 'row' | 'column'; align: 'start' | 'end' }) {
  const [open, setOpen] = useState(true);
  const [chosen, setChosen] = useState<string | null>(null);
  const pick = (name: string) => () => setChosen(chosen === name ? null : name);
  return (
    <SliceTray
      house="Brannock"
      colour={BRANNOCK}
      open={open}
      onToggle={() => setOpen(!open)}
      direction={direction}
      align={align}
      opened={
        chosen === 'Reason' && (
          <SliceOpened
            aspect={REASON}
            house="Brannock"
            state="answering"
            effects={REASONS_EFFECTS}
            slot="Master Oswin, reason 16"
            numbers={[
              ['power', 50],
              ['integrity', 46],
              ['summons', '0 of 3'],
            ]}
            onClose={() => setChosen(null)}
            width={340}
          />
        )
      }
    >
      <SliceChip aspect={INDUSTRY} state="idle" chosen={chosen === 'Industry'} onPress={pick('Industry')} />
      <SliceChip aspect={REASON} state="answering" chosen={chosen === 'Reason'} onPress={pick('Reason')} />
      <SliceChip
        aspect={AUTHORITY}
        state="idle"
        chosen={chosen === 'Authority'}
        onPress={pick('Authority')}
      />
    </SliceTray>
  );
}

/** The parts a challenge's spectacle is built from, each in its states. Decision record 0116. */
export function Challenges() {
  return (
    <>
      <Part title="The slice chip">
        <p className="ui-label showcase__lead">
          One chip a slice, in its house’s tray: whether it can work in the happening going on, said in its
          words and in its edge, with the pips of what it bears. Pressed, it opens the slice. The marks are
          the aspects’ drawn placeholders; nothing here reads a picture yet.
        </p>
        <Specimens>
          {STATES.map((one) => (
            <Specimen key={one.state} name={`SliceChip state="${one.state}"`} note={one.note}>
              <SliceChip
                aspect={one.aspect}
                state={one.state}
                said={one.said}
                borne={one.borne}
                onPress={() => {}}
              />
            </Specimen>
          ))}
        </Specimens>
        <Specimens>
          <Specimen name="SliceChip borne" note="a buff on gilt, a debuff on velvet, seconds left">
            <SliceChip aspect={VIOLENCE} state="working" borne={[HASTENED, WEAKENED]} onPress={() => {}} />
          </Specimen>
          <Specimen name="SliceChip chosen" note="the one opened above the tray">
            <SliceChip aspect={REASON} state="answering" chosen onPress={() => {}} />
          </Specimen>
          <Specimen name="showing hover">
            <SliceChip aspect={DIPLOMACY} state="working" showing="hover" onPress={() => {}} />
          </Specimen>
          <Specimen name="showing pressed">
            <SliceChip aspect={DIPLOMACY} state="working" showing="pressed" onPress={() => {}} />
          </Specimen>
          <Specimen name="showing focus">
            <SliceChip aspect={DIPLOMACY} state="working" showing="focus" onPress={() => {}} />
          </Specimen>
          <Specimen name="disabled">
            <SliceChip aspect={DIPLOMACY} state="working" disabled onPress={() => {}} />
          </Specimen>
        </Specimens>
      </Part>

      <Part title="The tray">
        <p className="ui-label showcase__lead">
          A house’s slices: its pennant and name on the head, which folds the chips away and back. In a row
          along the bottom of a wide stage, in a column up the side of a deep one, keeping to the house’s own
          edge. Press Reason to open it.
        </p>
        <Specimens>
          <Specimen
            name='SliceTray direction="row" align="start"'
            note="held here: fold it, open a slice"
            wide
          >
            <LiveTray direction="row" align="start" />
          </Specimen>
          <Specimen name='SliceTray direction="column" align="end"' note="up the side of a deep stage">
            <LiveTray direction="column" align="end" />
          </Specimen>
          <Specimen name="SliceTray open={false}" note="folded to its head">
            <SliceTray house="Varga" colour={VARGA} open={false} onToggle={() => {}}>
              <SliceChip aspect={HOLY} state="matching" />
            </SliceTray>
          </Specimen>
          <Specimen name="SliceTray showing focus" note="its head as the keyboard finds it">
            <SliceTray house="Varga" colour={VARGA} open={false} onToggle={() => {}} showing="focus">
              <SliceChip aspect={HOLY} state="matching" />
            </SliceTray>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="The slice opened">
        <p className="ui-label showcase__lead">
          Its two effects, each with what it needs of the happening - a matching aspect, its anti-aspect, or
          any - and whether it works now; what stands in its slot; its numbers. A container,{' '}
          <code>card.slice</code>.
        </p>
        <Specimens>
          <Specimen name="SliceOpened" note="answering its anti-aspect in a happening of Holy">
            <SliceOpened
              aspect={REASON}
              house="Brannock"
              state="answering"
              effects={REASONS_EFFECTS}
              slot="Master Oswin, reason 16"
              numbers={[
                ['power', 50],
                ['integrity', 46],
                ['summons', '0 of 3'],
              ]}
              onClose={() => {}}
            />
          </Specimen>
          <Specimen
            name="SliceOpened, waiting"
            note="both effects need a matching aspect, in a happening of Reason"
          >
            <SliceOpened
              aspect={HOLY}
              house="Varga"
              state="idle"
              effects={HOLYS_EFFECTS}
              slot="the Cathedral of Varga, level 3, on the line"
              numbers={[
                ['power', 50],
                ['integrity', 50],
                ['summons', '1 of 3'],
              ]}
              borne={[WEAKENED]}
              onClose={() => {}}
            />
          </Specimen>
        </Specimens>
      </Part>

      <Part title="The tug">
        <p className="ui-label showcase__lead">
          The tug as a share of the bar, the first house’s colour from the left as far as its share: at 28
          toward Varga, Varga has 64 parts in a hundred. So it moves as the crowd or the ground it stands over
          does, and what it says rides the split. Drag the live one.
        </p>
        <Specimens>
          <Specimen name="TugBar tug={0}" note="even">
            <TugBar first={VARGA_SIDE} second={BRANNOCK_SIDE} tug={0} said="even" />
          </Specimen>
          <Specimen name="TugBar tug={28.3}" note="leaning toward the first">
            <TugBar first={VARGA_SIDE} second={BRANNOCK_SIDE} tug={28.3} said="28.3 toward Varga" />
          </Specimen>
          <Specimen name="TugBar tug={100}" note="pulled to the first’s end">
            <TugBar first={VARGA_SIDE} second={BRANNOCK_SIDE} tug={100} said="100 toward Varga" />
          </Specimen>
          <Specimen name="TugBar tug={-100}" note="pulled to the second’s end">
            <TugBar first={VARGA_SIDE} second={BRANNOCK_SIDE} tug={-100} said="100 toward Brannock" />
          </Specimen>
          <Specimen name="TugBar, live" note="held here: drag the slider under it" wide>
            <LiveTug />
          </Specimen>
        </Specimens>
      </Part>

      <Part title="The happening">
        <p className="ui-label showcase__lead">
          The happening going on, over the stage: its aspects’ discs, its name, the seconds it runs, and whom
          it lights.
        </p>
        <Specimens>
          <Specimen name="HappeningPlate" note="one aspect" wide>
            <HappeningPlate
              aspects={[HOLY]}
              name="Holy"
              when="second 15 to 30"
              said="Varga’s Holy matches, ×1.5 · Brannock’s Reason answers its anti-aspect"
            />
          </Specimen>
          <Specimen name="HappeningPlate, two aspects" note="a happening of two, each lighting a house" wide>
            <HappeningPlate
              aspects={[VIOLENCE, INDUSTRY]}
              name="Violence and Industry"
              when="second 45 to 60"
              said="Varga’s Violence matches, ×1.5 · Brannock’s Industry matches, ×1.5"
            />
          </Specimen>
          <Specimen name="HappeningPlate, nobody lit" note="a happening no slice matches" wide>
            <HappeningPlate
              aspects={[AUTHORITY]}
              name="Authority"
              when="second 0 to 20"
              said="nothing matches"
            />
          </Specimen>
        </Specimens>
      </Part>
    </>
  );
}
