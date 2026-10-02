import { useState } from 'react';

import { usePictures } from '../../ui/art/pictures';
import { MarkButton } from '../../ui/button/Button';
import { Container } from '../../ui/container/Container';
import { Divider } from '../../ui/divider/Divider';
import { Expander } from '../../ui/expander/Expander';
import { Mark } from '../../ui/mark/Mark';
import { TitlePlate } from '../../ui/plate/TitlePlate';
import { ResourceReadout } from '../../ui/readout/ResourceReadout';
import { ScrollArea } from '../../ui/scroll/ScrollArea';
import { TabBar, Tabbed } from '../../ui/tabs/TabBar';
import type { Tab } from '../../ui/tabs/TabBar';
import { TAB_HEIGHTS } from '../../ui/tabs/tabs';
import type { TabSize } from '../../ui/tabs/tabs';
import { Part, Specimen, Specimens } from './Specimen';

/** Three panes taking turns, in words. */
const WORD_TABS: readonly Tab[] = [
  { id: 'house', label: 'House' },
  { id: 'figures', label: 'Key figures' },
  { id: 'letters', label: 'Letters' },
];

/** What each of them holds, a line or two. */
const HELD: Record<string, string> = {
  house: 'The house of Montreuil holds three places and owes nobody. Its seat is at Paris.',
  figures: 'The Count de Montreuil, noble and rationalist, and two others the house has taken in.',
  letters: 'Two letters, unread: one from Lyon about the harvest, one from the Church about the tithe.',
  holdings: 'Paris, Lyon and Montreuil, and the roads between them.',
  influence: 'Three hundred and forty, and rising half a point a second.',
  reason: 'Fifty-eight, and rising a fifth of a point a second.',
};

/** The same, as the game's own bar has them: marks and no words. */
const MARK_TABS: readonly Tab[] = [
  { id: 'holdings', label: 'Holdings', mark: 'domain' },
  { id: 'influence', label: 'Influence', mark: 'influence' },
  { id: 'reason', label: 'Reason', mark: 'reason' },
];

/** Every state a tab is drawn in, side by side. */
const STATE_TABS: readonly Tab[] = [
  { id: 'chosen', label: 'Chosen' },
  { id: 'rest', label: 'At rest' },
  { id: 'hover', label: 'Hovered', showing: 'hover' },
  { id: 'pressed', label: 'Pressed', showing: 'pressed' },
  { id: 'focus', label: 'Focused', showing: 'focus' },
  { id: 'disabled', label: 'Disabled', disabled: true },
];

/** Too many for a narrow pane: the row scrolls across rather than wrapping. */
const MANY_TABS: readonly Tab[] = [
  { id: 'house', label: 'House' },
  { id: 'figures', label: 'Key figures' },
  { id: 'letters', label: 'Letters' },
  { id: 'debts', label: 'Debts' },
  { id: 'roads', label: 'Roads' },
  { id: 'faith', label: 'Faith' },
];

const SIZES = Object.keys(TAB_HEIGHTS) as TabSize[];

/** Letters enough to need scrolling. */
const LETTERS = [
  'From Lyon, about the harvest',
  'From the Church, about the tithe',
  'From the Count of Anjou, an offer of marriage',
  'From the guild of weavers, a complaint',
  'From Montreuil, the steward’s accounts',
  'From the Academy, a paper on the comet',
  'From the Duke, a summons to court',
  'From the bishop, a sermon',
  'From Lyon again, the harvest is in',
  'From the river toll, a bill',
  'From a cousin, a request for money',
  'From the Academy, the comet came back',
  'From the Duke, the summons withdrawn',
  'From the steward, the roof leaks',
];

/** A house's five, for a row too long for its room. */
const FIVE = [
  { mark: 'wealth', word: 'Wealth', total: 1240 },
  { mark: 'domain', word: 'Domain', total: 12 },
  { mark: 'influence', word: 'Influence', total: 340 },
  { mark: 'reason', word: 'Reason', total: 58 },
  { mark: 'piety', word: 'Piety', total: 96 },
] as const;

export function TabsAndSections() {
  const { list, problem } = usePictures();
  const [words, setWords] = useState('house');
  const [marks, setMarks] = useState('holdings');
  const [many, setMany] = useState('house');
  const [said, say] = useState('nothing chosen yet');
  if (list === null) {
    return <p className="showcase__to-come">{problem ?? 'Reading the pictures…'}</p>;
  }
  return (
    <>
      <Part title="Tab bars">
        <p className="ui-label showcase__lead">
          Panes taking turns in one place, the tabs tucked under the pane’s border. Press one, or tab to the
          chosen one and go along with the arrow keys; Home and End go to the ends.{' '}
          <span className="showcase__said">{said}</span>
        </p>
        <Specimens>
          <Specimen name="Tabbed" note="in words" wide>
            <div className="showcase__tabbed">
              <Tabbed
                tabs={WORD_TABS}
                chosen={words}
                onChoose={(id) => {
                  setWords(id);
                  say(`${id}, chosen`);
                }}
                label="What the house is looking at"
              >
                <p className="ui-body">{HELD[words]}</p>
              </Tabbed>
            </div>
          </Specimen>
          <Specimen
            name={'Tabbed size="small" end'}
            note={['in marks, as the game’s own bar has them', 'with something at its far end']}
            wide
          >
            <div className="showcase__tabbed">
              <Tabbed
                tabs={MARK_TABS}
                chosen={marks}
                onChoose={(id) => {
                  setMarks(id);
                  say(`${id}, chosen`);
                }}
                label="What is in this corner"
                size="small"
                end={
                  <MarkButton
                    label="Make it bigger"
                    mark="maximise"
                    size="small"
                    onClick={() => say('make it bigger, pressed')}
                  />
                }
              >
                <p className="ui-body">{HELD[marks]}</p>
              </Tabbed>
            </div>
          </Specimen>
        </Specimens>
        <Specimens>
          <Specimen name="TabBar" note="every state a tab has" wide>
            <TabBar tabs={STATE_TABS} chosen="chosen" onChoose={() => undefined} label="Every state" />
          </Specimen>
          {SIZES.map((size) => (
            <Specimen key={size} name={`size="${size}"`} note={`${TAB_HEIGHTS[size]} pixels tall`}>
              <span className="showcase__try">
                <TabBar tabs={WORD_TABS} chosen="house" onChoose={() => undefined} label={size} size={size} />
                <TabBar
                  tabs={MARK_TABS}
                  chosen="holdings"
                  onChoose={() => undefined}
                  label={size}
                  size={size}
                />
              </span>
            </Specimen>
          ))}
          <Specimen name="Tabbed" note={['too many for its room', 'the row scrolls across, and fades']}>
            <div className="showcase__narrow">
              <Tabbed tabs={MANY_TABS} chosen={many} onChoose={setMany} label="Too many">
                <p className="ui-body">The {many} pane.</p>
              </Tabbed>
            </div>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Expandable sections">
        <p className="ui-label showcase__lead">
          A heading that folds what is under it open and shut, in a fifth of a second. What it says at the far
          end is said either way.
        </p>
        <Specimens>
          <Specimen name="Expander" note="three in a pane, the second open" wide>
            <div className="showcase__pane-width">
              <Container recipe="pane.plain">
                <Expander title="Holdings" aside="3 places">
                  <p className="ui-body">{HELD.holdings}</p>
                </Expander>
                <Expander title="Letters" aside="2 unread" startOpen>
                  <p className="ui-body">{HELD.letters}</p>
                </Expander>
                <Expander title="Debts">
                  <p className="ui-body">None. The house owes nobody.</p>
                </Expander>
              </Container>
            </div>
          </Specimen>
          {(
            [
              { name: 'shut', open: false },
              { name: 'open', open: true },
              { name: 'hovered', open: false, showing: 'hover' },
              { name: 'focused', open: false, showing: 'focus' },
            ] as const
          ).map((state) => (
            <Specimen key={state.name} name="Expander" note={state.name}>
              <div className="showcase__card-width">
                <Expander
                  title="Letters"
                  aside="2"
                  open={state.open}
                  {...('showing' in state ? { showing: state.showing } : {})}
                >
                  <p className="ui-body">Two, unread.</p>
                </Expander>
              </div>
            </Specimen>
          ))}
        </Specimens>
      </Part>

      <Part title="Scroll areas">
        <p className="ui-label showcase__lead">
          A box that scrolls inside itself, and fades at an edge with more beyond it. Scrolling it never
          scrolls the page, and the keyboard can stop on it when there is more than fits.
        </p>
        <Specimens>
          <Specimen name={'ScrollArea style={{ maxHeight: 180 }}'} note="down, a list of letters in a pane">
            <div className="showcase__card-wide">
              <Container recipe="pane.plain">
                <ScrollArea label="Letters" style={{ maxHeight: 180 }}>
                  <ol className="showcase__letters">
                    {LETTERS.map((letter) => (
                      <li key={letter} className="ui-body">
                        {letter}
                      </li>
                    ))}
                  </ol>
                </ScrollArea>
              </Container>
            </div>
          </Specimen>
          <Specimen name={'ScrollArea axis="across"'} note="across, a row too long for its room">
            <div className="showcase__narrow">
              <ScrollArea axis="across" label="The house’s five">
                <span className="showcase__readouts showcase__readouts--row">
                  {FIVE.map((one) => (
                    <ResourceReadout
                      key={one.mark}
                      mark={one.mark}
                      word={one.word}
                      amountAt={() => one.total}
                      showWord
                    />
                  ))}
                </span>
              </ScrollArea>
            </div>
          </Specimen>
          <Specimen name="ScrollArea" note={['everything fits', 'no fade, and no stop for the keyboard']}>
            <div className="showcase__card-width">
              <ScrollArea label="Two letters" style={{ maxHeight: 180 }}>
                <ol className="showcase__letters">
                  {LETTERS.slice(0, 2).map((letter) => (
                    <li key={letter} className="ui-body">
                      {letter}
                    </li>
                  ))}
                </ol>
              </ScrollArea>
            </div>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Dividers">
        <p className="ui-label showcase__lead">
          The moodboard’s rules between sections: a line laid between its two ends at any width, a knot in its
          middle, or a section’s name on it.
        </p>
        <Specimens>
          <Specimen name="Divider" note="the rule on its own" wide>
            <Divider />
          </Specimen>
          {(
            [
              ['knot-boss', undefined],
              ['knot-fleur', undefined],
              ['sunburst', 30],
            ] as const
          ).map(([knot, height]) => (
            <Specimen
              key={knot}
              name={`Divider knot="${knot}"${height === undefined ? '' : ` knotHeight={${height}}`}`}
              wide
            >
              <Divider knot={knot} {...(height === undefined ? {} : { knotHeight: height })} />
            </Specimen>
          ))}
          <Specimen
            name={'Divider title="Motifs"'}
            note="a section’s name, the rule running on after it"
            wide
          >
            <Divider title="Motifs" />
          </Specimen>
          <Specimen name={'Divider title="UI Components" align="middle"'} note="in its middle" wide>
            <Divider title="UI Components" align="middle" />
          </Specimen>
          <Specimen name="Divider" note="between two things on a card">
            <div className="showcase__card-width">
              <Container recipe="card.figure">
                <h4 className="ui-heading">Count de Montreuil</h4>
                <p className="ui-label">Noble · Rationalist</p>
                <Divider knot="knot-fleur" />
                <p className="ui-quote">“Reason must be our highest authority.”</p>
              </Container>
            </div>
          </Specimen>
          <Specimen name="Divider" note="narrow">
            <div style={{ width: 90 }}>
              <Divider knot="knot-boss" />
            </div>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Title plates">
        <p className="ui-label showcase__lead">
          The cartouche a place’s name and its figure sit on, as wide as its words, and a pane’s name on the
          same plate at a little over half the size.
        </p>
        <Specimens>
          <Specimen name="TitlePlate" note="as the moodboard has Paris">
            <TitlePlate
              title="Paris"
              figure={3245}
              says="Prosperity"
              emblem={<Mark name="domain" size={26} />}
            />
          </Specimen>
          <Specimen name="TitlePlate" note="no emblem">
            <TitlePlate title="Lyon" figure={1980} says="Trade" />
          </Specimen>
          <Specimen name="TitlePlate" note="a long name, and the plate as long" wide>
            <TitlePlate title="Saint-Germain-des-Prés" figure={412} says="Faith" />
          </Specimen>
          <Specimen name="TitlePlate" note="a name and nothing else">
            <TitlePlate title="Montreuil" />
          </Specimen>
          <Specimen name={'TitlePlate recipe="plate.heading"'} note="a pane’s name">
            <TitlePlate title="St. Vitus Cathedral" recipe="plate.heading" />
          </Specimen>
          <Specimen name="TitlePlate" note={['held to 180 pixels', 'the name gives way first']}>
            <div style={{ width: 180 }}>
              <TitlePlate title="Saint-Germain-des-Prés" figure={412} says="Faith" />
            </div>
          </Specimen>
        </Specimens>
      </Part>
    </>
  );
}
