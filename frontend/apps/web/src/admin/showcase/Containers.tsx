import type { ReactNode } from 'react';

import { usePictures } from '../../ui/art/pictures';
import { Container } from '../../ui/container/Container';
import type { Recipe } from '../../ui/container/layout';
import { RECIPE_NAMES, RECIPES } from '../../ui/container/recipes';
import type { RecipeName } from '../../ui/container/recipes';
import { Part, Specimen, Specimens } from './Specimen';

/** A recipe written out as it is in `recipes.ts`, so what is on the page is what a session edits. */
function sourceOf(name: string, recipe: Recipe): string {
  const body = JSON.stringify(recipe, null, 2)
    .replace(/"([a-zA-Z]+)":/g, '$1:')
    .replace(/"/g, "'");
  return `'${name}': ${body}`;
}

function RecipeSource({ name }: { name: RecipeName }) {
  return <pre className="showcase__recipe">{sourceOf(name, RECIPES[name])}</pre>;
}

/** Words for a container to hold, as the moodboard's panels hold them. */
function Cathedral() {
  return (
    <>
      <h3 className="ui-heading">St. Vitus Cathedral</h3>
      <p className="ui-label">Faith · Influence</p>
      <p className="ui-body ui-numeral">+3 Faith a turn</p>
      <p className="ui-body ui-numeral">+1 Stability</p>
      <p className="ui-quote">Religious tensions are rising in the capital.</p>
    </>
  );
}

function Pane({ title }: { title: string }) {
  return (
    <>
      <h3 className="ui-heading">{title}</h3>
      <p className="ui-label">A pane, as a recipe draws it</p>
      <p className="ui-body">
        The house keeps a ledger of what it holds and what it owes, and the ledger is read here. The words run
        to whatever width the pane is given, and a cherub stands on the corner rather than in them.
      </p>
    </>
  );
}

function Figure({ name, what, stats }: { name: string; what: string; stats: string }) {
  return (
    <>
      <h4 className="ui-heading">{name}</h4>
      <p className="ui-label">{what}</p>
      <p className="ui-body ui-numeral">{stats}</p>
    </>
  );
}

/** What each recipe is shown holding. */
const HOLDS: Record<RecipeName, () => ReactNode> = {
  'pane.cherub-corner': () => <Pane title="The house of Montreuil" />,
  'pane.cathedral': () => <Cathedral />,
  'pane.drape': () => <Pane title="A drape and a cherub, painted in" />,
  'pane.arch': () => <Pane title="Under the arch" />,
  'pane.plain': () => <Pane title="A plain pane, for a tab bar to tuck under" />,
  'pane.cherubs': () => <Pane title="The house of Montreuil" />,
  'pane.acanthus': () => <Pane title="The house of Montreuil" />,
  'card.figure': () => <Figure name="Count de Montreuil" what="Noble · Rationalist" stats="12 · 8 · 4" />,
  'tooltip.plain': () => <span className="ui-body">Keep your holdings in sight</span>,
  'choice.frame': () => <span className="ui-body">One of a few, side by side</span>,
  'dialog.plain': () => (
    <>
      <h3 className="ui-heading">Kill Count Henri de Montreuil?</h3>
      <p className="ui-body">He will be gone from the house for good. This cannot be undone.</p>
    </>
  ),
  'toast.plain': () => <span className="ui-body">Sister Agathe joined the house</span>,
  'plate.place': () => <span className="ui-heading">Paris</span>,
  'plate.heading': () => <span className="ui-heading">St. Vitus Cathedral</span>,
  'card.event': () => (
    <>
      <h4 className="ui-heading">The Reformation Spreads</h4>
      <p className="ui-body">
        New doctrines challenge the Church in the capital. Tensions are rising across Europe.
      </p>
    </>
  ),
};

export function Containers() {
  const { list, problem } = usePictures();
  if (list === null) {
    return <p className="showcase__to-come">{problem ?? 'Reading the pictures…'}</p>;
  }
  return (
    <>
      <Part title="The sentence">
        <p className="ui-label showcase__lead">
          “A container for this pane: a border, and an embellished cherub in one corner.” As a recipe, at
          three widths. The cherub stands on the corner, over the moulding and out past it, and the words keep
          the whole width. Put <em>layers</em> on, in the bar, to see its box and where the words start.
        </p>
        <Specimens>
          {[260, 380, '100%'].map((width) => (
            <Specimen
              key={width}
              name="pane.cherub-corner"
              note={typeof width === 'number' ? `${width} wide` : 'as wide as the sheet'}
              wide
            >
              <div style={{ width, maxWidth: '100%' }}>
                <Container recipe="pane.cherub-corner">{HOLDS['pane.cherub-corner']()}</Container>
              </div>
            </Specimen>
          ))}
        </Specimens>
        <RecipeSource name="pane.cherub-corner" />
      </Part>

      <Part title="Recipes">
        <p className="ui-label showcase__lead">
          Every recipe there is, holding what it is for, with the recipe as it is written. A new pane is a new
          one of these.
        </p>
        <Specimens>
          {RECIPE_NAMES.map((name) => (
            <Specimen key={name} name={name} wide={name.startsWith('pane.')}>
              <div className="showcase__recipe-row">
                <div className={name.startsWith('card.') ? 'showcase__card-width' : 'showcase__pane-width'}>
                  <Container recipe={name}>{HOLDS[name]()}</Container>
                </div>
                <RecipeSource name={name} />
              </div>
            </Specimen>
          ))}
        </Specimens>
      </Part>

      <Part title="Any size">
        <p className="ui-label showcase__lead">
          Drag the corner. The border stretches, the cross stays on the crown, the cherub stays at the foot,
          and the drape hangs behind the whole of it.
        </p>
        <div className="showcase__resizable showcase__resizable--across" style={{ width: 460 }}>
          <Container recipe="pane.cathedral">
            <Cathedral />
          </Container>
        </div>
      </Part>

      <Part title="A card inside a pane">
        <p className="ui-label showcase__lead">Two containers, one inside the other: nothing more to it.</p>
        <Container recipe="pane.drape">
          <h3 className="ui-heading">Key figures</h3>
          <div className="showcase__cards">
            <Container recipe="card.figure">
              <Figure name="Count de Montreuil" what="Noble · Rationalist" stats="12 · 8 · 4" />
            </Container>
            <Container recipe="card.figure">
              <Figure name="Sister Agathe" what="Cleric · Devout" stats="6 · 14 · 9" />
            </Container>
            <Container recipe="card.event">
              <Figure name="Master Voss" what="Engineer · Curious" stats="9 · 7 · 12" />
            </Container>
          </div>
        </Container>
      </Part>
    </>
  );
}
