import type { CSSProperties, ReactNode } from 'react';

import { HappeningSeal } from '../../ui/seal/HappeningSeal';
import type { SealState } from '../../ui/seal/HappeningSeal';
import { HOLY, INDUSTRY, REASON, VIOLENCE } from './challengeSamples';
import { Part, Specimen, Specimens } from './Specimen';

/** A patch of the square's cobbles, to float a seal over as the diorama will. */
const GROUND: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  gap: 28,
  minWidth: 150,
  padding: '40px 24px 14px',
  borderRadius: 6,
  background: 'linear-gradient(180deg, #c4b593, #d3c6a6)',
};

function Ground({ children }: { children: ReactNode }) {
  return <div style={GROUND}>{children}</div>;
}

const STATES: readonly { readonly state: SealState; readonly note: string }[] = [
  { state: 'forming', note: 'in the mist, a few seconds before its happening' },
  { state: 'coming', note: 'drifting along its path' },
  { state: 'arrived', note: 'at the receptacle, its happening begun' },
  { state: 'spent', note: 'fading as the next arrives' },
];

/** A happening's seal, in its states, of one aspect and of two. */
export function ChallengeSeals() {
  return (
    <Part title="The happening’s seal">
      <p className="ui-label showcase__lead">
        A happening as it travels through a venue: a glowing medallion, half in the world, its aspect’s mark
        large on its face, or both marks for a happening of two. Its foot is its bottom middle. Drawn; nothing
        to paint yet.
      </p>
      <Specimens>
        {STATES.map((one) => (
          <Specimen key={one.state} name={`HappeningSeal state="${one.state}"`} note={one.note}>
            <Ground>
              <HappeningSeal aspects={[HOLY]} state={one.state} />
            </Ground>
          </Specimen>
        ))}
      </Specimens>
      <Specimens>
        {STATES.map((one) => (
          <Specimen key={one.state} name={`HappeningSeal, two aspects, "${one.state}"`}>
            <Ground>
              <HappeningSeal aspects={[VIOLENCE, INDUSTRY]} state={one.state} />
            </Ground>
          </Specimen>
        ))}
      </Specimens>
      <Specimens>
        <Specimen name="HappeningSeal size" note="44, 64 and 96 across" wide>
          <Ground>
            {[44, 64, 96].map((size) => (
              <HappeningSeal key={size} aspects={[REASON]} state="coming" size={size} />
            ))}
          </Ground>
        </Specimen>
      </Specimens>
    </Part>
  );
}
