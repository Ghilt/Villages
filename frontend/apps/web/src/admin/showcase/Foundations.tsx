import '@fontsource-variable/cormorant-garamond';
import '@fontsource-variable/cormorant-garamond/wght-italic.css';

import { COLOURS, SPACES } from '../../ui/tokens';
import { Part, Specimen, Specimens } from './Specimen';

/** A token's value as the stylesheet has it, read back rather than written twice. */
function valueOf(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
}

/**
 * The faces the type could be set in, side by side on the same words, so that choosing one is looking
 * rather than imagining. The first is the one the library uses; the last is the game's face today.
 */
const FACES = [
  {
    family: "'EB Garamond Variable', serif",
    name: 'EB Garamond',
    note: 'the library’s, proposed: Latin, Cyrillic, Greek, Vietnamese',
  },
  {
    family: "'Cormorant Garamond Variable', serif",
    name: 'Cormorant Garamond',
    note: 'finer and taller, for display: no Greek',
  },
  {
    family: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
    name: 'Palatino Linotype',
    note: 'the game’s today, from the machine rather than the page',
  },
];

/** Words from more of the world than English, where a face without the letters shows it at once. */
const ELSEWHERE = [
  'Kungens råd samlas i Uppsala',
  'Größe der Fürstentümer',
  'L’Église et la Raison',
  'Zażółć gęślą jaźń',
  'Собор Святого Вита',
  'Ο καθεδρικός ναός',
  'Nhà thờ Thánh Vitus',
];

export function Foundations() {
  return (
    <>
      <Part title="Colours">
        <p className="ui-label showcase__lead">
          Sampled from the moodboard, and a proposal: the values are in <code>ui/ui.css</code> and nowhere
          else.
        </p>
        <div className="showcase__palette">
          {COLOURS.map((group) => (
            <div key={group.name} className="showcase__swatches">
              <h4 className="showcase__swatch-group">{group.name}</h4>
              {group.tokens.map((token) => (
                <div key={token.name} className="showcase__swatch">
                  <span className="showcase__chip" style={{ background: `var(--${token.name})` }} />
                  <span className="showcase__swatch-name">--{token.name}</span>
                  <span className="showcase__swatch-value">{valueOf(token.name)}</span>
                  <span className="showcase__swatch-for">{token.for}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Part>

      <Part title="Type">
        <Specimens>
          <Specimen name="ui-title" note="a page’s or a pane’s name" wide>
            <h2 className="ui-title">The House of Montreuil</h2>
          </Specimen>
          <Specimen name="ui-epigraph" note="the line under a title" wide>
            <p className="ui-epigraph">Enlightenment · Faith · Science · Power</p>
          </Specimen>
          <Specimen name="ui-heading" note="a thing’s name">
            <h3 className="ui-heading">Count de Montreuil</h3>
          </Specimen>
          <Specimen name="ui-label" note="what it is, under its name">
            <span className="ui-label">Noble · Rationalist</span>
          </Specimen>
          <Specimen name="ui-caps" note="a section’s name">
            <h4 className="ui-caps">Key figures</h4>
          </Specimen>
          <Specimen name="ui-numeral" note="lining and tabular, so a count does not jitter">
            <span className="ui-numeral showcase__numerals">3,245 · 12 · 8 · +3 · 1789</span>
          </Specimen>
          <Specimen name="ui-body" note="what is read" wide>
            <p className="ui-body">
              New doctrines challenge the Church in the capital. Tensions are rising across Europe, and the
              faithful look to the cathedral for an answer it has not yet given.
            </p>
          </Specimen>
          <Specimen name="ui-quote" note="somebody speaking" wide>
            <p className="ui-quote">“Reason must be our highest authority.”</p>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="The face, to choose">
        <p className="ui-label showcase__lead">
          The same words in each. The type is Adam’s to choose: <code>--ui-font-text</code> is the one line
          that changes.
        </p>
        <div className="showcase__faces">
          {FACES.map((face) => (
            <div key={face.name} className="showcase__face" style={{ fontFamily: face.family }}>
              <p className="showcase__face-name">
                {face.name}
                <span className="showcase__face-note">{face.note}</span>
              </p>
              <p className="showcase__face-title">St. Vitus Cathedral</p>
              <p className="showcase__face-italic">Faith · Influence · Religious tensions</p>
              <p className="showcase__face-body">
                New doctrines challenge the Church in the capital. Tensions are rising across Europe.
              </p>
              <p className="showcase__face-numerals">3,245 · +3 a turn · 1789 · 0123456789</p>
              <ul className="showcase__face-elsewhere">
                {ELSEWHERE.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Part>

      <Part title="Space">
        <div className="showcase__spaces">
          {SPACES.map((token) => (
            <div key={token.name} className="showcase__space">
              <span className="showcase__space-bar" style={{ width: `var(--${token.name})` }} />
              <span className="showcase__swatch-name">--{token.name}</span>
              <span className="showcase__swatch-value">{valueOf(token.name)}</span>
              <span className="showcase__swatch-for">{token.for}</span>
            </div>
          ))}
        </div>
      </Part>
    </>
  );
}
