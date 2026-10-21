import { useState } from 'react';

import { SliceChip, SliceOpened, SliceTray } from '../../ui/slice/Slice';
import type { AspectShown } from '../../ui/slice/Slice';
import type { Borne, SliceState } from '../../ui/slice/sliceWords';
import {
  AUTHORITY,
  BRANNOCK,
  DIPLOMACY,
  EMPOWERED,
  HASTENED,
  HOLY,
  HOLYS_EFFECTS,
  INDUSTRY,
  REASON,
  REASONS_EFFECTS,
  VARGA,
  VIOLENCE,
  WEAKENED,
} from './challengeSamples';
import { Part, Specimen, Specimens } from './Specimen';

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

/** A challenge's slices, in their states: the chip, the tray, the slice opened. */
export function ChallengeSlices() {
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
    </>
  );
}
