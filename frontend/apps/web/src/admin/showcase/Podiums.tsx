import { useState } from 'react';

import { Podium } from '../../ui/podium/Podium';
import { Part, Specimen, Specimens } from './Specimen';

/**
 * Take action as the die on its podium: at rest, the long press part way, the die out and its slot empty, greyed with
 * its reason, and small for a strip; and one to press, which says what it was told. See
 * `docs/plans/choice-roll-podium.md`.
 */
export function Podiums() {
  const [out, setOut] = useState(false);
  const [said, setSaid] = useState('press and hold the die');
  const where = (x: number, y: number) => `${Math.round(x)}, ${Math.round(y)}`;

  return (
    <Part title="Take action, the die on its podium">
      <Specimens>
        <Specimen name="Podium" note="at rest">
          <Podium words="Take action" aside="costs 10 wealth" />
        </Specimen>
        <Specimen name="Podium showing={0.6}" note="held, the ring filling round it">
          <Podium words="Take action" aside="costs 10 wealth" showing={0.6} />
        </Specimen>
        <Specimen name="Podium out" note="the die in the hand or on the map; its slot empty">
          <Podium words="Take action" aside="costs 10 wealth" out />
        </Specimen>
        <Specimen name="Podium disabled" note="greyed, saying why">
          <Podium words="Take action" aside="a roll costs 10 wealth, and the house has 4 free" disabled />
        </Specimen>
        <Specimen name='Podium size="small"' note="in a strip or a chip">
          <Podium words="Take action" aside="10 wealth" size="small" />
        </Specimen>
        <Specimen name="Podium, pressed" note={said}>
          <Podium
            words="Take action"
            aside="costs 10 wealth"
            out={out}
            onLift={(lifted) => {
              setOut(true);
              setSaid(`lifted at ${where(lifted.x, lifted.y)}${lifted.byTouch ? ' by a finger' : ''}`);
            }}
            onMove={(moved) => {
              const last = moved[moved.length - 1]!;
              setSaid(`held, at ${where(last.x, last.y)}`);
            }}
            onLetGo={(at) => {
              setOut(false);
              setSaid(`let go at ${where(at.x, at.y)}: on the map, it would fall there`);
            }}
            onPutBack={() => {
              setOut(false);
              setSaid('put back: nothing happens');
            }}
            onDrop={() => setSaid('Enter: dropped at the middle of the view')}
          />
        </Specimen>
      </Specimens>
    </Part>
  );
}
