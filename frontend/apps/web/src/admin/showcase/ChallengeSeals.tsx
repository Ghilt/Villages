import type { CSSProperties, ReactNode } from 'react';

import { latticeOf } from '../../ui/diorama/lattice';
import { LatticeGround } from '../../ui/diorama/LatticeGround';
import { HappeningSeal } from '../../ui/seal/HappeningSeal';
import type { SealState } from '../../ui/seal/HappeningSeal';
import { HOLY, INDUSTRY, REASON, VIOLENCE } from './challengeSamples';
import { Part, Specimen, Specimens } from './Specimen';

/** A patch of the square's cobbles, to float a seal over as the diorama will. */
const GROUND: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  gap: 40,
  minWidth: 150,
  padding: '30px 24px 52px',
  borderRadius: 6,
  overflow: 'hidden',
};
const PATCH = { width: 400, height: 160 };

function Ground({ children }: { children: ReactNode }) {
  return (
    <div style={GROUND}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <LatticeGround
          scene={PATCH}
          lattice={latticeOf({ x: 200, y: 0 }, 24)}
          id="showcase-seal-ground"
          fill="#cbbd9c"
          joint="rgba(60,48,30,0.3)"
        />
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 40 }}>{children}</div>
    </div>
  );
}

const STATES: readonly { readonly state: SealState; readonly note: string }[] = [
  { state: 'waiting', note: 'faded in the mist, the next to come' },
  { state: 'forming', note: 'in the mist, a few seconds before it sets out' },
  { state: 'coming', note: 'sliding along its path' },
  { state: 'arrived', note: 'at the receptacle, its happening begun' },
  { state: 'spent', note: 'fading as the next arrives' },
];

/** A happening's seal, in its states, of one aspect and of two. */
export function ChallengeSeals() {
  return (
    <Part title="The happening’s seal">
      <p className="ui-label showcase__lead">
        A happening as it travels through a venue: a gilt-rimmed diamond tile, half in the world, turned half
        a right angle to the map’s lattice so it is a diamond on the grid too, tipped as the ground is,
        hovering over its shadow; its aspect’s mark, lined up with the grid, on its face, or both marks for a
        happening of two. Its foot is the ground under its middle. Drawn; nothing to paint yet.
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
        <Specimen name="HappeningSeal cells" note="1, 1.5 and 2.5 cells of the lattice across" wide>
          <Ground>
            {[1, 1.5, 2.5].map((cells) => (
              <HappeningSeal key={cells} aspects={[REASON]} state="coming" cells={cells} />
            ))}
          </Ground>
        </Specimen>
      </Specimens>
    </Part>
  );
}
