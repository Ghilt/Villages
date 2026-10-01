import { useState } from 'react';

import { MarkButton } from '../../ui/button/Button';
import { Card } from '../../ui/card/Card';
import { Carousel } from '../../ui/carousel/Carousel';
import { Container } from '../../ui/container/Container';
import { Dots } from '../../ui/dots/Dots';
import { List, ListRow } from '../../ui/list/List';
import { Mark } from '../../ui/mark/Mark';
import type { MarkName } from '../../ui/mark/Mark';
import { ScrollArea } from '../../ui/scroll/ScrollArea';
import { FIGURES, Portrait, Stats } from './sampleFigures';
import { Part, Specimen, Specimens } from './Specimen';

/** A choice roll's options, as the game offers them: what it is in a few words, and what it would mean. */
const OPTIONS: readonly { readonly title: string; readonly said: string }[] = [
  {
    title: 'Settle at Montreuil',
    said: 'A seat on the river, with a mill and a market, and the abbey a day away.',
  },
  {
    title: 'Take the road north',
    said: 'Three days to Lille, and a cousin there who owes the house a favour.',
  },
  { title: 'Wait for word from Paris', said: 'The court has not yet said what it wants of the house.' },
];

/** The house's holdings, as a list in its pane would have them. */
const HOLDINGS: readonly {
  readonly name: string;
  readonly what: string;
  readonly mark: MarkName;
  readonly yields: string;
}[] = [
  { name: 'Paris', what: 'Prosperity · 3,245 souls', mark: 'domain', yields: '+12' },
  { name: 'Lyon', what: 'Trade · 1,980 souls', mark: 'wealth', yields: '+8' },
  { name: 'Montreuil', what: 'Faith · 412 souls', mark: 'piety', yields: '+3' },
  { name: 'Saint-Germain-des-Prés', what: 'Faith · 260 souls', mark: 'piety', yields: '+2' },
];

/** Every state a row is shown in, one under another. */
const ROW_STATES: readonly {
  readonly name: string;
  readonly props: Partial<Parameters<typeof ListRow>[0]>;
}[] = [
  { name: 'At rest', props: {} },
  { name: 'Hovered', props: { showing: 'hover' } },
  { name: 'Pressed', props: { showing: 'pressed' } },
  { name: 'Focused', props: { showing: 'focus' } },
  { name: 'Chosen', props: { chosen: true } },
  { name: 'Disabled', props: { disabled: true } },
];

/** The second half of the collections: the carousel and its dots, and the list. */
export function CarouselsAndLists() {
  const [option, setOption] = useState(0);
  const [taken, setTaken] = useState<string | null>(null);
  const [dot, setDot] = useState(1);
  const [holding, setHolding] = useState('Paris');
  const [looked, setLooked] = useState<string | null>(null);
  return (
    <>
      <Part title="Carousels">
        <p className="ui-label showcase__lead">
          One thing at a time, a step either side and a dot for each beneath: the small form of a list. Step
          with the arrows, the dots, the arrow keys, or a swipe on a phone.{' '}
          <span className="showcase__said">
            {taken === null ? `showing ${option + 1} of ${OPTIONS.length}` : `taken: ${taken}`}
          </span>
        </p>
        <Specimens>
          <Specimen
            name="Carousel"
            note={["a choice roll's options, round and round", 'press one to take it']}
            wide
          >
            <div className="showcase__carousel">
              <Carousel label="The options" at={option} onAt={setOption}>
                {OPTIONS.map((one) => (
                  <Card key={one.title} title={one.title} onPress={() => setTaken(one.title)}>
                    <p className="ui-body">{one.said}</p>
                  </Card>
                ))}
              </Carousel>
            </div>
          </Specimen>
          <Specimen
            name="Carousel wrap={false}"
            note={['the key figures, one by one', 'its steps stop at either end']}
            wide
          >
            <div className="showcase__carousel">
              <Carousel label="Key figures" wrap={false}>
                {FIGURES.map((figure) => (
                  <Card
                    key={figure.portrait}
                    recipe="card.event"
                    across
                    picture={<Portrait figure={figure} />}
                    title={figure.full}
                    line={figure.what}
                  >
                    <Stats figure={figure} />
                  </Card>
                ))}
              </Carousel>
            </div>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Dots">
        <p className="ui-label showcase__lead">
          A dot for each thing, the one shown a gilt ball. A dot that can be pressed goes to its thing, with
          room round it for a finger; one that cannot only says where in the run the one shown is.{' '}
          <span className="showcase__said">at {dot + 1} of 5</span>
        </p>
        <Specimens>
          <Specimen name="Dots onAt" note="press one, or tab to them">
            <Dots count={5} at={dot} onAt={setDot} label="Which one" />
          </Specimen>
          <Specimen name="Dots" note="saying where, and nothing to press">
            <Dots count={5} at={1} label="Which one" />
          </Specimen>
          <Specimen name={'Dots showing="hover"'} note="the rest hovered">
            <Dots count={5} at={1} onAt={() => undefined} label="Which one" showing="hover" />
          </Specimen>
          <Specimen name={'Dots showing="focus"'} note="the rest focused">
            <Dots count={5} at={1} onAt={() => undefined} label="Which one" showing="focus" />
          </Specimen>
          <Specimen name="Dots count={2}" note="two">
            <Dots count={2} at={0} onAt={() => undefined} label="Which one" />
          </Specimen>
          <Specimen name="Dots count={9}" note="nine, as many key figures as there can be">
            <Dots count={9} at={4} onAt={() => undefined} label="Which one" />
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Lists">
        <p className="ui-label showcase__lead">
          Things one under another with a fine rule between, each a row: something at its start, its name and
          what is said about it, and something at its end. Given something to do, the whole row is one button.{' '}
          <span className="showcase__said">
            {holding}
            {looked === null ? '' : `; looking for ${looked}`}
          </span>
        </p>
        <Specimens>
          <Specimen
            name="List of ListRow"
            note={["the house's holdings, in a pane", 'press one to choose it']}
            wide
          >
            <div className="showcase__list-width">
              <Container recipe="pane.plain">
                <List label="Holdings">
                  {HOLDINGS.map((one) => (
                    <ListRow
                      key={one.name}
                      lead={<Mark name={one.mark} size={20} />}
                      title={one.name}
                      line={one.what}
                      trail={<span className="ui-numeral">{one.yields}</span>}
                      chosen={holding === one.name}
                      onPress={() => setHolding(one.name)}
                    />
                  ))}
                </List>
              </Container>
            </div>
          </Specimen>
          <Specimen name="ListRow" note="every state a row has" wide>
            <div className="showcase__list-width">
              <Container recipe="card.event">
                <List label="Every state">
                  {ROW_STATES.map((state) => (
                    <ListRow
                      key={state.name}
                      lead={<Mark name="domain" size={20} />}
                      title={state.name}
                      line="Prosperity · 3,245 souls"
                      trail={<span className="ui-numeral">+12</span>}
                      onPress={() => undefined}
                      {...state.props}
                    />
                  ))}
                </List>
              </Container>
            </div>
          </Specimen>
          <Specimen
            name="List in a ScrollArea"
            note={['the key figures, a portrait at the start', 'and a button of its own at the end']}
            wide
          >
            <div className="showcase__list-width">
              <Container recipe="card.event">
                <ScrollArea label="Key figures" style={{ maxHeight: 250 }} focusable={false}>
                  <List label="Key figures">
                    {FIGURES.map((figure) => (
                      <ListRow
                        key={figure.portrait}
                        lead={<Portrait figure={figure} />}
                        title={figure.full}
                        line={figure.what}
                        onPress={() => setLooked(null)}
                        trail={
                          <MarkButton
                            label={`Look for ${figure.given} on the map`}
                            mark="eye-open"
                            size="small"
                            onClick={() => setLooked(figure.full)}
                          />
                        }
                      />
                    ))}
                  </List>
                </ScrollArea>
              </Container>
            </div>
          </Specimen>
        </Specimens>
      </Part>
    </>
  );
}
