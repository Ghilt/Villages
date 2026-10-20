import './challenges.css';

import { ASPECTS, antiOf, filledIn, parseChallenges } from '@villages/world';
import type {
  Aspect,
  ChallengeEffect,
  ChallengeKind,
  ChallengeSlot,
  ChallengeSummon,
  Challenges as Content,
} from '@villages/world';

import { FlagField, LevelsField, NumberField, WordsField } from '../frame/Fields';
import { InspectPage } from '../frame/InspectPage';
import { SaveBar, WholeFile } from '../frame/SaveBar';
import { useCatalogueEditor } from '../frame/useCatalogueEditor';
import type { CatalogueEditor, Path } from '../frame/useCatalogueEditor';
import { Simulator } from './Simulator';

type Editor = CatalogueEditor<Content>;

/** An aspect as the page says it: `Violence`. */
export const said = (aspect: Aspect) => aspect.charAt(0).toUpperCase() + aspect.slice(1);

/** The five pairs, each an aspect and its anti-aspect, in the catalogue's order. */
const PAIRS = ASPECTS.filter((_, at) => at % 2 === 0).map((aspect) => [aspect, antiOf(aspect)] as const);

/**
 * The challenge's content, `world/catalogues/challenges.json`, to read and to change: every effect a slice can carry,
 * in the five pairs of aspects, with its name, its words and its numbers, the slot it brings and the summon it hires;
 * every summon; and the kinds of challenge a progression is drawn from. Every name, word and number is changed in
 * place and saved through the game server, which takes it on at once. Below, the simulator has the server's engine
 * fight a challenge out on what is in force. See docs/plans/challenges.md and decision record 0105.
 */
export function Challenges() {
  const editor = useCatalogueEditor('challenges.json', parseChallenges);
  const content = editor.value;
  return (
    <InspectPage
      title="Challenges"
      bar={
        <span className="inspect-note">
          {content === null
            ? ''
            : `${content.effects.length} effects, ${content.summons.length} summons, ${content.kinds.length} kinds `}
          from world/catalogues/challenges.json
        </span>
      }
    >
      <SaveBar editor={editor} />
      {editor.reading.state === 'reading' && (
        <p className="inspect-quiet">reading world/catalogues/challenges.json</p>
      )}
      {editor.reading.state === 'unread' && <p className="inspect-problem">{editor.reading.problem}</p>}
      {content !== null && (
        <>
          {content.said[''] !== '' && <p className="inspect-said">{content.said['']}</p>}
          <Effects editor={editor} content={content} />
          <Summons editor={editor} content={content} />
          <Kinds editor={editor} content={content} />
        </>
      )}
      <Simulator />
      <WholeFile editor={editor} />
    </InspectPage>
  );
}

function Effects({ editor, content }: { editor: Editor; content: Content }) {
  return (
    <section className="inspect-group" aria-label="effects">
      <h2 className="inspect-group__title">effects</h2>
      {content.said.effects !== '' && <p className="inspect-said">{content.said.effects}</p>}
      {PAIRS.map(([aspect, anti]) => (
        <div key={aspect} className="challenges-pair">
          {[aspect, anti].map((one) => (
            <div key={one} className="challenges-aspect">
              <h3 className="inspect-group__subtitle">{said(one)}</h3>
              {content.effects
                .filter((effect) => effect.aspect === one)
                .map((effect) => (
                  <Effect key={effect.id} editor={editor} effect={effect} summons={content.summons} />
                ))}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function Effect({
  editor,
  effect,
  summons,
}: {
  editor: Editor;
  effect: ChallengeEffect;
  summons: readonly ChallengeSummon[];
}) {
  const at: Path = ['effects', effect.aspect, effect.key];
  const summon = summons.find((one) => one.id === effect.summons);
  return (
    <div className="challenges-effect">
      <div className="challenges-effect__head">
        <WordsField editor={editor} path={[...at, 'name']} label={`${effect.id} name`} />{' '}
        <span className="challenges-fires">{effect.fires}</span>{' '}
        <span className="inspect-key">{effect.id}</span>
      </div>
      <WordsField editor={editor} path={[...at, 'words']} label={`${effect.id} words`} wide />
      <Numbers editor={editor} at={[...at, 'numbers']} numbers={effect.numbers} label={effect.id} />
      <div>{filledIn(effect.words, effect.numbers)}</div>
      {effect.slot !== null && (
        <div className="inspect-quiet">
          slot: {slotSaid(effect.slot)}{' '}
          <FlagField editor={editor} path={[...at, 'slot', 'onTheLine']} label="on the line" />
        </div>
      )}
      {summon !== undefined && (
        <div className="inspect-quiet">
          summons {article(summon.name)} {summon.name}: {filledIn(summon.words, summon.numbers)}
        </div>
      )}
    </div>
  );
}

/** An entry's numbers, each by its name, as the words name them in braces. */
function Numbers({
  editor,
  at,
  numbers,
  label,
}: {
  editor: Editor;
  at: Path;
  numbers: Readonly<Record<string, number>>;
  label: string;
}) {
  const names = Object.keys(numbers);
  if (names.length === 0) return null;
  return (
    <ul className="inspect-each">
      {names.map((name) => (
        <li key={name}>
          <span className="inspect-key">{name}</span>{' '}
          <NumberField editor={editor} path={[...at, name]} label={`${label} ${name}`} />
        </li>
      ))}
    </ul>
  );
}

/** `a` or `an`, as the name after it sounds: an Enforcer, a Mercenary. */
const article = (name: string) => (/^[AEIOU]/i.test(name) ? 'an' : 'a');

function slotSaid(slot: ChallengeSlot): string {
  const what = slot.fits === 'keyFigure' ? 'a key figure' : 'a building its side holds';
  if (slot.lends === null) return what;
  return `${what}, lending their ${slot.lends}`;
}

function Summons({ editor, content }: { editor: Editor; content: Content }) {
  return (
    <section className="inspect-group inspect-scroll" aria-label="summons">
      <h2 className="inspect-group__title">summons</h2>
      {content.said.summons !== '' && <p className="inspect-said">{content.said.summons}</p>}
      <table className="inspect-table">
        <thead>
          <tr>
            <th>summon</th>
            <th>aspect</th>
            <th>what it does</th>
            <th>brought by</th>
          </tr>
        </thead>
        <tbody>
          {content.summons.map((summon) => (
            <tr key={summon.id}>
              <th scope="row">
                <WordsField
                  editor={editor}
                  path={['summons', summon.id, 'name']}
                  label={`${summon.id} name`}
                />
              </th>
              <td>{said(summon.aspect)}</td>
              <td>
                <WordsField
                  editor={editor}
                  path={['summons', summon.id, 'words']}
                  label={`${summon.id} words`}
                  wide
                />
                <Numbers
                  editor={editor}
                  at={['summons', summon.id, 'numbers']}
                  numbers={summon.numbers}
                  label={summon.id}
                />
                <div>{filledIn(summon.words, summon.numbers)}</div>
              </td>
              <td>
                {content.effects
                  .filter((effect) => effect.summons === summon.id)
                  .map((effect) => effect.name)
                  .join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Kinds({ editor, content }: { editor: Editor; content: Content }) {
  return (
    <section className="inspect-group inspect-scroll" aria-label="kinds">
      <h2 className="inspect-group__title">kinds</h2>
      {content.said.kinds !== '' && <p className="inspect-said">{content.said.kinds}</p>}
      <table className="inspect-table">
        <thead>
          <tr>
            <th>kind</th>
            <th>seconds</th>
            <th>happenings</th>
            <th>two aspects</th>
            <th>weights</th>
          </tr>
        </thead>
        <tbody>
          {content.kinds.map((kind) => (
            <Kind key={kind.id} editor={editor} kind={kind} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Kind({ editor, kind }: { editor: Editor; kind: ChallengeKind }) {
  const at: Path = ['kinds', kind.id];
  return (
    <tr>
      <th scope="row">
        <WordsField editor={editor} path={[...at, 'name']} label={`${kind.id} name`} />
        <br />
        <WordsField editor={editor} path={[...at, 'words']} label={`${kind.id} words`} wide />
      </th>
      <td>
        <LevelsField editor={editor} path={[...at, 'seconds']} label={`${kind.id} seconds, fewest / most`} />
      </td>
      <td>
        <LevelsField
          editor={editor}
          path={[...at, 'happenings']}
          label={`${kind.id} happenings, fewest / most`}
        />
      </td>
      <td>
        <NumberField editor={editor} path={[...at, 'twoAspects']} label={`${kind.id} two aspects`} />%
      </td>
      <td>
        <ul className="inspect-each">
          {ASPECTS.map((aspect) => (
            <li key={aspect}>
              <span className="inspect-key">{aspect}</span>{' '}
              <NumberField
                editor={editor}
                path={[...at, 'weights', aspect]}
                label={`${kind.id} weight of ${aspect}`}
              />
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}
