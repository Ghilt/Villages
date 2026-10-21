import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { FieldFigure } from '../../ui/fieldFigure/FieldFigure';
import { BRANNOCK, EMPOWERED, HOLY, INDUSTRY, VARGA, VIOLENCE, WEAKENED } from './challengeSamples';
import { Part, Specimen, Specimens } from './Specimen';

/** A patch of the square's cobbles, to stand a figure on as the diorama will. */
const GROUND: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  gap: 36,
  minWidth: 150,
  padding: '64px 24px 34px',
  borderRadius: 6,
  background: 'linear-gradient(180deg, #c4b593, #d3c6a6)',
};

function Ground({ children }: { children: ReactNode }) {
  return <div style={GROUND}>{children}</div>;
}

/** A figure that pulls every second and a half, so its number is seen rising. */
function Pulling() {
  const [times, setTimes] = useState(0);
  useEffect(() => {
    const every = setInterval(() => setTimes((now) => now + 1), 1500);
    return () => clearInterval(every);
  }, []);
  return (
    <FieldFigure
      kind="summon"
      facing="east"
      colour={VARGA}
      name="Mercenary #1"
      aspect={VIOLENCE}
      pulled={{ amount: times % 3 === 2 ? 12 : 7.5, key: times }}
    />
  );
}

/** A figure on a challenge's field, in its states. */
export function ChallengeFigures() {
  return (
    <Part title="A figure on the field">
      <p className="ui-label showcase__lead">
        A head over a cloak that widens to the hem, as the map draws a person, in its side’s colour. Turned
        east or west and no other way: west is the same drawing mirrored, so one picture serves both houses.
        Its box stands on its foot. Drawn, until a summon has a picture.
      </p>
      <Specimens>
        <Specimen
          name='FieldFigure facing="east"'
          note="the first house’s, on the left bank, turned to face across"
        >
          <Ground>
            <FieldFigure kind="summon" facing="east" colour={VARGA} name="Mercenary #1" aspect={VIOLENCE} />
          </Ground>
        </Specimen>
        <Specimen name='FieldFigure facing="west"' note="the other’s, mirrored">
          <Ground>
            <FieldFigure kind="summon" facing="west" colour={BRANNOCK} name="Machine #2" aspect={INDUSTRY} />
          </Ground>
        </Specimen>
        <Specimen name="FieldFigure lit" note="its aspect matches: Empowered, lit from under its feet">
          <Ground>
            <FieldFigure
              kind="summon"
              facing="east"
              colour={VARGA}
              name="Priest #4"
              aspect={HOLY}
              lit
              borne={[EMPOWERED]}
            />
          </Ground>
        </Specimen>
        <Specimen name="FieldFigure borne" note="a debuff’s pip and its seconds">
          <Ground>
            <FieldFigure
              kind="summon"
              facing="east"
              colour={VARGA}
              name="Mercenary #1"
              aspect={VIOLENCE}
              borne={[WEAKENED]}
            />
          </Ground>
        </Specimen>
        <Specimen name="FieldFigure pulled" note="what it pulled rises and fades, each time it pulls">
          <Ground>
            <Pulling />
          </Ground>
        </Specimen>
        <Specimen name="FieldFigure fallen" note="killed: lies down grey and fades">
          <Ground>
            <FieldFigure
              kind="summon"
              facing="west"
              colour={BRANNOCK}
              name="Machine #2"
              aspect={INDUSTRY}
              fallen
            />
          </Ground>
        </Specimen>
        <Specimen name='FieldFigure kind="keyFigure"' note="a gilt circlet, no staff">
          <Ground>
            <FieldFigure kind="keyFigure" facing="west" colour={BRANNOCK} name="Master Oswin" />
          </Ground>
        </Specimen>
        <Specimen
          name='FieldFigure kind="townsperson"'
          note="in no house’s colour, facing whoever is winning them"
        >
          <Ground>
            <FieldFigure kind="townsperson" facing="west" height={52} />
            <FieldFigure kind="townsperson" facing="east" height={52} />
          </Ground>
        </Specimen>
        <Specimen name="FieldFigure height" note="40, 64 and 96 pixels" wide>
          <Ground>
            {[40, 64, 96].map((height) => (
              <FieldFigure
                key={height}
                kind="summon"
                facing="east"
                colour={VARGA}
                height={height}
                aspect={VIOLENCE}
              />
            ))}
          </Ground>
        </Specimen>
      </Specimens>
    </Part>
  );
}
