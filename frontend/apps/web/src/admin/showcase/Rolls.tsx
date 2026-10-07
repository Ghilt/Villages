import './rolls.css';

import { useState } from 'react';

import { TextButton } from '../../ui/button/Button';
import { Card } from '../../ui/card/Card';
import type { Rarity } from '../../ui/card/Card';
import { Container } from '../../ui/container/Container';
import { OmenRow, OmenStrip, ReportCard } from '../../ui/report/ReportCard';
import type { OmenLine } from '../../ui/report/ReportCard';
import { RolledHand } from '../../ui/report/RolledHand';
import type { HandForm } from '../../ui/report/RolledHand';
import { usePlay } from '../../ui/report/usePlay';
import { Part, Specimen, Specimens } from './Specimen';

/** What a roll at a house with a letter open and a key figure up reads: one omen of every kind. */
const OMENS: readonly OmenLine[] = [
  { key: 'house.holdings', kind: 'house', words: 'Holdings in the northern reaches' },
  { key: 'house.pious', kind: 'house', words: 'Pious', value: 104 },
  { key: 'change.piety', kind: 'change', words: 'Piety risen', value: 30 },
  { key: 'window.house', kind: 'window', words: 'Inspecting House Varga' },
  { key: 'dialogue', kind: 'dialogue', words: 'Unresolved: A letter from the coast' },
  { key: 'figure', kind: 'keyFigure', words: 'Jacob Marchand' },
  { key: 'map.river', kind: 'map', words: 'River' },
  { key: 'season', kind: 'season', words: 'Autumn' },
];

const HAND: readonly {
  readonly title: string;
  readonly gives: string;
  readonly omens: readonly OmenLine[];
}[] = [
  { title: 'Shelter a pilgrim of renown', gives: '+120 piety', omens: [OMENS[1]!, OMENS[2]!] },
  { title: "A wreck's cargo comes ashore on your land", gives: '+120 wealth', omens: [OMENS[6]!] },
  { title: 'A seat on the regional council', gives: '+120 influence', omens: [OMENS[3]!, OMENS[5]!] },
];

const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

/** Each form of the hand in a room the size the game gives it. */
const ROOMS: readonly {
  readonly form: HandForm;
  readonly w: number;
  readonly h: number;
  readonly says: string;
}[] = [
  { form: 'full', w: 620, h: 700, says: 'opened out on a desktop, over everything' },
  { form: 'stacked', w: 390, h: 520, says: 'on a phone: one under another, scrolling' },
];

/**
 * The choice roll's parts: the report card the omens slam into, the strip of marks it folds to, and the options
 * that pop in under it - played whole in each form the game draws it in, again on a press, and each part on its
 * own. The rarity is the options' to say, by their tag and their glow. See decision record 0083.
 */
export function Rolls() {
  const [rolls, setRolls] = useState(0);
  const [rarity, setRarity] = useState<Rarity>('rare');
  const { play, hurry } = usePlay(rolls === 0 ? null : `roll ${rolls}`, OMENS.length, HAND.length);
  const roll = (at: Rarity) => {
    setRarity(at);
    setRolls((was) => was + 1);
  };
  const options = HAND.map((one) => (
    <Card key={one.title} rarity={rarity} title={one.title} line={one.gives} onPress={() => undefined}>
      <OmenStrip omens={one.omens} small />
    </Card>
  ));

  return (
    <>
      <Part title="A roll, played">
        <p className="ui-label showcase__lead">
          The omens land one after another, then the options pop in under them. A press on the list hurries
          it. <span className="showcase__said">{play.phase}</span>
        </p>
        <div className="showcase__try">
          {RARITIES.map((one) => (
            <TextButton key={one} size="small" onClick={() => roll(one)}>
              {`roll ${one}`}
            </TextButton>
          ))}
        </div>
        <Specimens>
          {ROOMS.map((room) => (
            <Specimen key={room.form} name={`RolledHand form="${room.form}"`} note={room.says} wide>
              <div className="showcase__room showcase__roll-room" style={{ width: room.w, height: room.h }}>
                <Container recipe="pane.middle" fills>
                  <div
                    className={
                      room.form === 'stacked' ? 'showcase__roll showcase__roll--scroll' : 'showcase__roll'
                    }
                  >
                    <RolledHand
                      form={room.form}
                      omens={OMENS}
                      play={play}
                      options={options}
                      onHurry={hurry}
                    />
                  </div>
                </Container>
              </div>
            </Specimen>
          ))}
        </Specimens>
      </Part>

      <Part title="Its parts">
        <Specimens>
          <Specimen name="ReportCard" note="every omen landed" wide>
            <ReportCard omens={OMENS} />
          </Specimen>
          <Specimen name="OmenRow" note="one of every kind, with its mark" wide>
            <ol className="ui-report__rows">
              {OMENS.map((omen) => (
                <OmenRow key={omen.key} omen={omen} />
              ))}
            </ol>
          </Specimen>
          <Specimen name="OmenStrip" note={['the list folded away', 'hover a mark for its words']}>
            <OmenStrip omens={OMENS} />
          </Specimen>
          <Specimen name="OmenStrip small" note="on an option, the omens that brought it">
            <div className="showcase__card-small">
              <Card rarity="rare" title={HAND[0]!.title} line={HAND[0]!.gives}>
                <OmenStrip omens={HAND[0]!.omens} small />
              </Card>
            </div>
          </Specimen>
        </Specimens>
      </Part>
    </>
  );
}
