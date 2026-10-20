import './challenges.css';

import { ASPECTS, antiOf, filledIn, parseChallenges } from '@villages/world';
import type {
  Aspect,
  ChallengeEffect,
  ChallengeSlot,
  ChallengeSummon,
  Challenges as Content,
} from '@villages/world';

import { InspectPage } from '../frame/InspectPage';
import { useCatalogue } from '../frame/useCatalogue';

/** An aspect as the page says it: `Violence`. */
export const said = (aspect: Aspect) => aspect.charAt(0).toUpperCase() + aspect.slice(1);

/** The five pairs, each an aspect and its anti-aspect, in the catalogue's order. */
const PAIRS = ASPECTS.filter((_, at) => at % 2 === 0).map((aspect) => [aspect, antiOf(aspect)] as const);

/**
 * The challenge's content, `world/catalogues/challenges.json`: every effect a slice can carry, in the five pairs of
 * aspects, with what it does in words and numbers, the slot it brings and the summon it hires; every summon; and the
 * kinds of challenge a progression is drawn from. Read through the dev server, and again whenever the file changes.
 * The simulator, which runs the server's engine on it, comes below in a later step. See docs/plans/challenges.md.
 */
export function Challenges() {
  const reading = useCatalogue('challenges.json', parseChallenges);
  const content = reading.state === 'read' ? reading.shelved.value : null;
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
      {reading.state === 'reading' && (
        <p className="inspect-quiet">reading world/catalogues/challenges.json</p>
      )}
      {reading.state === 'unread' && <p className="inspect-problem">{reading.problem}</p>}
      {content !== null && (
        <>
          {content.said[''] !== '' && <p className="inspect-said">{content.said['']}</p>}
          <Effects content={content} />
          <Summons content={content} />
          <Kinds content={content} />
        </>
      )}
    </InspectPage>
  );
}

function Effects({ content }: { content: Content }) {
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
                  <Effect key={effect.id} effect={effect} summons={content.summons} />
                ))}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function Effect({ effect, summons }: { effect: ChallengeEffect; summons: readonly ChallengeSummon[] }) {
  const summon = summons.find((one) => one.id === effect.summons);
  return (
    <div className="challenges-effect">
      <div className="challenges-effect__head">
        <strong>{effect.name}</strong> <span className="challenges-fires">{effect.fires}</span>{' '}
        <span className="inspect-key">{effect.id}</span>
      </div>
      <div>{filledIn(effect.words, effect.numbers)}</div>
      {effect.slot !== null && <div className="inspect-quiet">slot: {slotSaid(effect.slot)}</div>}
      {summon !== undefined && (
        <div className="inspect-quiet">
          summons {article(summon.name)} {summon.name}: {filledIn(summon.words, summon.numbers)}
        </div>
      )}
    </div>
  );
}

/** `a` or `an`, as the name after it sounds: an Enforcer, a Mercenary. */
const article = (name: string) => (/^[AEIOU]/i.test(name) ? 'an' : 'a');

function slotSaid(slot: ChallengeSlot): string {
  const what = slot.fits === 'keyFigure' ? 'a key figure' : 'a building its side holds';
  if (slot.onTheLine) return `${what}, put on the line`;
  return `${what}, lending their ${slot.lends}`;
}

function Summons({ content }: { content: Content }) {
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
              <th scope="row">{summon.name}</th>
              <td>{said(summon.aspect)}</td>
              <td>{filledIn(summon.words, summon.numbers)}</td>
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

function Kinds({ content }: { content: Content }) {
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
            <tr key={kind.id}>
              <th scope="row">
                {kind.name}
                <br />
                <span className="inspect-quiet">{kind.words}</span>
              </th>
              <td>
                {kind.seconds[0]} to {kind.seconds[1]}
              </td>
              <td>
                {kind.happenings[0]} to {kind.happenings[1]}
              </td>
              <td>{kind.twoAspects}%</td>
              <td>
                {ASPECTS.filter((aspect) => kind.weights[aspect] > 0)
                  .map((aspect) => `${said(aspect)} ${kind.weights[aspect]}`)
                  .join(' · ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
