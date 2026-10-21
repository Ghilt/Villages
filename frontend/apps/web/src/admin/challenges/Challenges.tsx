import './challenges.css';

import { ASPECTS, antiOf, filledIn, parseChallenges } from '@villages/world';
import type {
  ChallengeEffect,
  ChallengeKind,
  ChallengeLasting,
  ChallengeSlot,
  Challenges as Content,
} from '@villages/world';

import { FlagField, LevelsField, NumberField, WordsField } from '../frame/Fields';
import { InspectPage } from '../frame/InspectPage';
import { SaveBar, WholeFile } from '../frame/SaveBar';
import { useCatalogueEditor } from '../frame/useCatalogueEditor';
import type { CatalogueEditor, Path } from '../frame/useCatalogueEditor';
import { said } from './setup';
import { Matchups } from './Matchups';
import { Simulator } from './Simulator';

type Editor = CatalogueEditor<Content>;

/** The five pairs, each an aspect and its anti-aspect, in the catalogue's order. */
const PAIRS = ASPECTS.filter((_, at) => at % 2 === 0).map((aspect) => [aspect, antiOf(aspect)] as const);

/**
 * The challenge's content, `world/catalogues/challenges.json`, to read and to change: every effect a slice can carry,
 * in the five pairs of aspects, with its name, its words and its numbers, whether it needs a matching aspect, the slot
 * it brings, the summon it hires and the buff or debuff it puts on; every summon, and whether it needs one; the chart
 * of buffs and debuffs; and the kinds of challenge a progression is drawn from. Every name, word and number is changed in
 * place and saved through the game server, which takes it on at once. Below, the simulator has the server's engine
 * fight a challenge out on what is in force. See docs/plans/challenges.md and decision record 0107.
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
          <Lastings editor={editor} content={content} />
          <Kinds editor={editor} content={content} />
        </>
      )}
      <Simulator content={content} />
      <Matchups content={content} />
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
                  <Effect key={effect.id} editor={editor} effect={effect} content={content} />
                ))}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function Effect({ editor, effect, content }: { editor: Editor; effect: ChallengeEffect; content: Content }) {
  const at: Path = ['effects', effect.aspect, effect.key];
  const summon = content.summons.find((one) => one.id === effect.summons);
  const puts = lastingOf(content, effect.puts);
  return (
    <div className="challenges-effect">
      <div className="challenges-effect__head">
        <WordsField editor={editor} path={[...at, 'name']} label={`${effect.id} name`} />{' '}
        <span className="challenges-fires">{effect.fires}</span>{' '}
        <span className="inspect-key">{effect.id}</span>
      </div>
      <FlagField editor={editor} path={[...at, 'matching']} label="needs a matching aspect" />
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
      {puts !== undefined && (
        <div className="inspect-quiet">
          puts on {puts.name.toLowerCase()}: {filledIn(puts.words, puts.numbers)}
        </div>
      )}
    </div>
  );
}

/** A buff or a debuff by its id, whichever it is; none for none. */
const lastingOf = (content: Content, id: string | null): ChallengeLasting | undefined =>
  id === null ? undefined : [...content.buffs, ...content.debuffs].find((one) => one.id === id);

/**
 * The chart of buffs and debuffs: each one's name, whether it helps or hinders, what it goes on, what it does in words
 * with its numbers filled in, and the effects and summons that put it on, debuffs first.
 */
function Lastings({ editor, content }: { editor: Editor; content: Content }) {
  const rows = [
    ...content.debuffs.map((lasting) => ({ lasting, section: 'debuffs', kind: 'debuff' })),
    ...content.buffs.map((lasting) => ({ lasting, section: 'buffs', kind: 'buff' })),
  ];
  const putters = (id: string) =>
    [
      ...content.effects.filter((effect) => effect.puts === id).map((effect) => effect.name),
      ...content.summons.filter((summon) => summon.puts === id).map((summon) => `the ${summon.name}`),
    ].join(', ');
  return (
    <section className="inspect-group inspect-scroll" aria-label="buffs and debuffs">
      <h2 className="inspect-group__title">buffs and debuffs</h2>
      {content.said.debuffs !== '' && <p className="inspect-said">{content.said.debuffs}</p>}
      {content.said.buffs !== '' && <p className="inspect-said">{content.said.buffs}</p>}
      <table className="inspect-table challenges-lastings">
        <thead>
          <tr>
            <th>name</th>
            <th></th>
            <th>on</th>
            <th>what it does</th>
            <th>put on by</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ lasting, section, kind }) => (
            <tr key={lasting.id} className={`challenges-lastings__${kind}`}>
              <th scope="row">
                <WordsField
                  editor={editor}
                  path={[section, lasting.id, 'name']}
                  label={`${lasting.id} name`}
                />
              </th>
              <td>{kind}</td>
              <td>{lasting.on}</td>
              <td>
                <WordsField
                  editor={editor}
                  path={[section, lasting.id, 'words']}
                  label={`${lasting.id} words`}
                  wide
                />
                <Numbers
                  editor={editor}
                  at={[section, lasting.id, 'numbers']}
                  numbers={lasting.numbers}
                  label={lasting.id}
                />
                {Object.keys(lasting.numbers).length > 0 && (
                  <div>{filledIn(lasting.words, lasting.numbers)}</div>
                )}
              </td>
              <td>{putters(lasting.id)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {content.buffs.length === 0 && <p className="inspect-quiet">no buffs yet</p>}
    </section>
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
            <th>needs a matching aspect</th>
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
                <FlagField
                  editor={editor}
                  path={['summons', summon.id, 'matching']}
                  label={summon.matching ? 'yes' : 'no'}
                />
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
