import './rolls.css';

import { useState } from 'react';

import { TextButton } from '../../ui/button/Button';
import { Card } from '../../ui/card/Card';
import type { Rarity } from '../../ui/card/Card';
import { Container } from '../../ui/container/Container';
import { OmenRow, OmenStrip, RarityStamp, ReportCard } from '../../ui/report/ReportCard';
import type { OmenLine } from '../../ui/report/ReportCard';
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

/**
 * The choice roll's parts: the report card the omens slam into, the rarity stamped across it, and the list folded to
 * a strip of marks above the options that pop in - played whole in a tile the size of the bottom middle, again on a
 * press, and each part on its own. See decision record 0083.
 */
export function Rolls() {
  const [rolls, setRolls] = useState(0);
  const [rarity, setRarity] = useState<Rarity>('rare');
  const { play, hurry } = usePlay(rolls === 0 ? null : `roll ${rolls}`, OMENS.length, HAND.length);
  const roll = (at: Rarity) => {
    setRarity(at);
    setRolls((was) => was + 1);
  };

  return (
    <>
      <Part title="A roll, played">
        <p className="ui-label showcase__lead">
          The omens land one after another, the rarity is stamped across them, and the options pop in; then
          the list folds to its marks above them. A press on the list hurries it, and never the stamp.{' '}
          <span className="showcase__said">{play.phase}</span>
        </p>
        <div className="showcase__try">
          {RARITIES.map((one) => (
            <TextButton key={one} size="small" onClick={() => roll(one)}>
              {`roll ${one}`}
            </TextButton>
          ))}
        </div>
        <div className="showcase__room showcase__roll-room" style={{ width: 620, height: 300 }}>
          <Container recipe="pane.middle" fills>
            <div className="showcase__roll">
              {play.phase === 'rows' || play.phase === 'stamp' ? (
                <ReportCard
                  omens={OMENS}
                  landed={play.landed}
                  stamp={play.phase === 'stamp' ? rarity : null}
                  onHurry={hurry}
                />
              ) : (
                <>
                  <OmenStrip omens={OMENS} />
                  <ol className="showcase__hand">
                    {HAND.slice(0, play.cardsIn).map((one) => (
                      <li key={one.title} className={play.phase === 'cards' ? 'ui-pop' : ''}>
                        <Card rarity={rarity} title={one.title} line={one.gives} onPress={() => undefined}>
                          <OmenStrip omens={one.omens} small />
                        </Card>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          </Container>
        </div>
      </Part>

      <Part title="Its parts">
        <Specimens>
          <Specimen name="ReportCard" note="every omen landed, before the stamp" wide>
            <ReportCard omens={OMENS} landed={OMENS.length} />
          </Specimen>
          {RARITIES.map((one) => (
            <Specimen key={one} name={`RarityStamp rarity="${one}"`} note="over the list it lands on">
              <div className="showcase__stamped">
                <ReportCard omens={OMENS.slice(0, 3)} landed={3} stamp={one} />
              </div>
            </Specimen>
          ))}
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
          <Specimen name="RarityStamp" note="alone">
            <div className="showcase__stamped">
              <RarityStamp rarity="legendary" />
            </div>
          </Specimen>
        </Specimens>
      </Part>
    </>
  );
}
