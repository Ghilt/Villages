import { useState } from 'react';

import { portraitUrl } from '../../figures/portraits';
import { usePictures } from '../../ui/art/pictures';
import { Card } from '../../ui/card/Card';
import { Grid } from '../../ui/grid/Grid';
import { Mark } from '../../ui/mark/Mark';
import type { MarkName } from '../../ui/mark/Mark';
import { Stepper } from '../../ui/stepper/Stepper';
import architecture from './pictures/architecture.webp';
import cloth from './pictures/cloth.webp';
import clouds from './pictures/clouds.webp';
import industry from './pictures/industry.webp';
import reason from './pictures/reason.webp';
import reformation from './pictures/reformation.webp';
import religion from './pictures/religion.webp';
import science from './pictures/science.webp';
import upheaval from './pictures/upheaval.webp';
import { Part, Specimen, Specimens } from './Specimen';

/** A key figure to show, with one of the game's own portraits: the cut-paper placeholders until painted. */
interface Figure {
  readonly portrait: string;
  readonly given: string;
  readonly full: string;
  readonly what: string;
  readonly stats: readonly (readonly [MarkName, number])[];
}

const FIGURES: readonly Figure[] = [
  {
    portrait: 'man-01',
    given: 'Henri',
    full: 'Count Henri de Montreuil',
    what: 'Noble · Rationalist',
    stats: [
      ['influence', 12],
      ['reason', 8],
      ['piety', 4],
    ],
  },
  {
    portrait: 'woman-01',
    given: 'Agathe',
    full: 'Sister Agathe',
    what: 'Cleric · Devout',
    stats: [
      ['influence', 6],
      ['reason', 9],
      ['piety', 14],
    ],
  },
  {
    portrait: 'man-02',
    given: 'Voss',
    full: 'Master Anselm Voss',
    what: 'Engineer · Curious',
    stats: [
      ['influence', 5],
      ['reason', 13],
      ['piety', 3],
    ],
  },
  {
    portrait: 'woman-02',
    given: 'Odile',
    full: 'Odile Marchand',
    what: 'Merchant · Shrewd',
    stats: [
      ['influence', 10],
      ['reason', 7],
      ['piety', 5],
    ],
  },
  {
    portrait: 'man-03',
    given: 'Bastien',
    full: 'Captain Bastien Roux',
    what: 'Soldier · Loyal',
    stats: [
      ['influence', 7],
      ['reason', 4],
      ['piety', 8],
    ],
  },
  {
    portrait: 'woman-03',
    given: 'Margarethe',
    full: 'Margarethe von Hals',
    what: 'Scholar · Sceptic',
    stats: [
      ['influence', 4],
      ['reason', 15],
      ['piety', 2],
    ],
  },
  {
    portrait: 'man-04',
    given: 'Lucien',
    full: 'Lucien Ferrand',
    what: 'Steward · Careful',
    stats: [
      ['influence', 8],
      ['reason', 10],
      ['piety', 7],
    ],
  },
  {
    portrait: 'woman-04',
    given: 'Ysolde',
    full: 'Ysolde de Brévannes',
    what: 'Courtier · Ambitious',
    stats: [
      ['influence', 14],
      ['reason', 6],
      ['piety', 6],
    ],
  },
  {
    portrait: 'woman-05',
    given: 'Clémence',
    full: 'Clémence Aubry',
    what: 'Physician · Kind',
    stats: [
      ['influence', 5],
      ['reason', 11],
      ['piety', 9],
    ],
  },
];

const HENRI = FIGURES[0]!;

/** The moodboard's board of motifs, cut from it: soft, because each is a hundred and twenty pixels. */
const MOTIFS: readonly { readonly name: string; readonly picture: string }[] = [
  { name: 'Cloth', picture: cloth },
  { name: 'Architecture', picture: architecture },
  { name: 'Clouds', picture: clouds },
  { name: 'Religion', picture: religion },
  { name: 'Industry', picture: industry },
  { name: 'Science', picture: science },
  { name: 'Science & Reason', picture: reason },
  { name: 'Religious Upheaval', picture: upheaval },
];

/** Things that happened, each as long as it is, to show a row as tall as its tallest. */
const HAPPENINGS: readonly { readonly title: string; readonly picture: string; readonly said: string }[] = [
  {
    title: 'The Reformation Spreads',
    picture: reformation,
    said: 'New doctrines challenge the Church in the capital. Tensions are rising across Europe.',
  },
  { title: 'A Mill on the River', picture: industry, said: 'Smoke over the lower town.' },
  {
    title: 'The Academy Opens',
    picture: science,
    said: 'A society of learned men asks the house for a charter, a hall and a little money every year.',
  },
  { title: 'A Miracle Is Claimed', picture: religion, said: 'The bishop is not pleased.' },
];

/** The states a pressable card is shown in, side by side. */
const STATES: readonly { readonly name: string; readonly props: Partial<Parameters<typeof Card>[0]> }[] = [
  { name: 'at rest', props: {} },
  { name: 'hovered', props: { showing: 'hover' } },
  { name: 'pressed', props: { showing: 'pressed' } },
  { name: 'focused', props: { showing: 'focus' } },
  { name: 'chosen', props: { chosen: true } },
  { name: 'disabled', props: { disabled: true } },
];

function Portrait({ figure }: { figure: Figure }) {
  return <img src={portraitUrl(figure.portrait)} alt="" draggable={false} />;
}

function Stats({ figure }: { figure: Figure }) {
  return (
    <p className="ui-body ui-numeral showcase__figure-stats">
      {figure.stats.map(([mark, value]) => (
        <span key={mark} className="showcase__figure-stat">
          <Mark name={mark} size={15} title={mark} />
          {value}
        </span>
      ))}
    </p>
  );
}

export function Collections() {
  const { list, problem } = usePictures();
  const [count, setCount] = useState(9);
  const [open, setOpen] = useState<string | null>(null);
  const [pressed, setPressed] = useState(0);
  if (list === null) {
    return <p className="showcase__to-come">{problem ?? 'Reading the pictures…'}</p>;
  }
  const shown = FIGURES.find((figure) => figure.portrait === open);
  return (
    <>
      <Part title="Cards">
        <p className="ui-label showcase__lead">
          A container small enough to be one of many: a picture at its head or down its side, a name, what it
          is under the name, and whatever else it holds. The portraits are the game&rsquo;s own, still the
          cut-paper placeholders; the paintings are cut from the moodboard.
        </p>
        <Specimens>
          <Specimen name="Card" note={['a key figure, on card.figure', 'a portrait, three by four']}>
            <div className="showcase__card-width">
              <Card picture={<Portrait figure={HENRI} />} title={HENRI.full} line={HENRI.what}>
                <Stats figure={HENRI} />
              </Card>
            </div>
          </Specimen>
          <Specimen name="Card across" note="the portrait down the left, as the moodboard has it" wide>
            <div className="showcase__card-across">
              <Card across picture={<Portrait figure={HENRI} />} title={HENRI.full} line={HENRI.what}>
                <Stats figure={HENRI} />
                <p className="ui-quote">&ldquo;Reason must be our highest authority.&rdquo;</p>
              </Card>
            </div>
          </Specimen>
          <Specimen
            name={'Card recipe="card.event"'}
            note={['something that happened', 'a painting, two by one']}
          >
            <div className="showcase__card-width">
              <Card
                recipe="card.event"
                picture={<img src={reformation} alt="" />}
                shape={2}
                title="The Reformation Spreads"
              >
                <p className="ui-body">
                  New doctrines challenge the Church in the capital. Tensions are rising across Europe.
                </p>
              </Card>
            </div>
          </Specimen>
          <Specimen name="Card" note="words only">
            <div className="showcase__card-width">
              <Card title="A Letter from Vienna" line="Sealed · Unread">
                <p className="ui-body">The court asks after the health of the house, and after its debts.</p>
              </Card>
            </div>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Pressed">
        <p className="ui-label showcase__lead">
          Given something to do, the whole card is one button, its name stretched over it: it lifts under the
          pointer and goes back down pressed.{' '}
          <span className="showcase__said">
            {pressed === 0 ? 'not pressed yet' : `pressed ${pressed} ${pressed === 1 ? 'time' : 'times'}`}
          </span>
        </p>
        <Specimens>
          <Specimen name="Card onPress" note="press it, or tab to it and press Enter">
            <div className="showcase__card-small">
              <Card
                picture={<Portrait figure={FIGURES[1]!} />}
                title={FIGURES[1]!.given}
                label={FIGURES[1]!.full}
                onPress={() => setPressed((was) => was + 1)}
              />
            </div>
          </Specimen>
          {STATES.map((state) => (
            <Specimen key={state.name} name="Card onPress" note={state.name}>
              <div className="showcase__card-small">
                <Card
                  picture={<Portrait figure={FIGURES[2]!} />}
                  title={FIGURES[2]!.given}
                  onPress={() => undefined}
                  {...state.props}
                />
              </div>
            </Specimen>
          ))}
        </Specimens>
      </Part>

      <Part title="Grids">
        <p className="ui-label showcase__lead">
          Things of one kind in rows and columns, every cell the same width. The key figures are three by
          three and never scroll: drag the corner, and every portrait is as big as the tighter of the width
          and the height allows, and a fourth never moves the first three.{' '}
          <span className="showcase__said">
            {shown === undefined ? 'nobody shown' : `showing ${shown.full}`}
          </span>
        </p>
        <Specimens>
          <Specimen
            name="Grid columns={3} rows={3}"
            note={['the key figures, never scrolling', 'drag the corner; press one to show them']}
            wide
          >
            <div className="showcase__grid-demo">
              <div className="showcase__grid-count">
                <span className="ui-label">How many</span>
                <Stepper
                  value={count}
                  min={1}
                  max={9}
                  onChange={setCount}
                  label="How many key figures"
                  size="small"
                />
              </div>
              <div className="showcase__resizable showcase__room" style={{ width: 420, height: 500 }}>
                <Grid columns={3} rows={3} shape={0.62} label="Key figures">
                  {FIGURES.slice(0, count).map((figure) => (
                    <Card
                      key={figure.portrait}
                      picture={<Portrait figure={figure} />}
                      title={figure.given}
                      label={figure.full}
                      chosen={figure.portrait === open}
                      onPress={() => setOpen((was) => (was === figure.portrait ? null : figure.portrait))}
                    />
                  ))}
                </Grid>
              </div>
            </div>
          </Specimen>
          <Specimen
            name="Grid least={130}"
            note={['as many across as fit, none narrower than 130', "the moodboard's motifs"]}
            wide
          >
            <Grid least={130} label="Motifs">
              {MOTIFS.map((motif) => (
                <Card
                  key={motif.name}
                  recipe="card.event"
                  picture={<img src={motif.picture} alt="" />}
                  shape={1.05}
                  title={motif.name}
                />
              ))}
            </Grid>
          </Specimen>
          <Specimen name="Grid columns={2}" note="each card as tall as the tallest in its row" wide>
            <Grid columns={2} gap={14} label="What happened">
              {HAPPENINGS.map((one) => (
                <Card
                  key={one.title}
                  recipe="card.event"
                  picture={<img src={one.picture} alt="" />}
                  shape={2}
                  title={one.title}
                >
                  <p className="ui-body">{one.said}</p>
                </Card>
              ))}
            </Grid>
          </Specimen>
        </Specimens>
      </Part>

      <p className="showcase__to-come">
        The carousel and its dots, and the list, arrive with the second half of step 9.
      </p>
    </>
  );
}
