import { useState } from 'react';

import type { ResourceName } from '@villages/protocol';

import { RESOURCES_IN_ORDER, RESOURCE_WORDS, saysRate, saysStock } from '../house/describe';
import { sessionStore } from '../net/gateway';
import { Section } from './Section';
import { grantResource, pledgeResource, releasePledge, spendResource } from './levers';
import { useStore } from '../store/useStore';

/** How much a press is worth. Four, spanning the sizes a resource plausibly comes in. */
const STEPS = [1, 10, 100, 1000] as const;

/** How long a pledge is asked for. The shortest the world can express is a month, which is a real day. */
const SPANS = [1, 6, 40] as const;

/**
 * Making what a house has move, on purpose.
 *
 * **Adam's levers, not a player's.** Nothing in the game grants, spends or pledges anything yet, so
 * without these the only way to see the resource system do anything is to send commands from a console.
 * They are real commands and go the whole way round - the decider can refuse them, and the number on the
 * house card moves when the world says it has, not when a button is pressed. See decision record 0023.
 *
 * `release` is here for a reason worth stating: a pledge is asked for in months and a month is a real day,
 * so the shortest one there is cannot be watched out inside a sitting. Ending one early is not speeding
 * time up - the world's clock is untouched and shared - it is doing to one pledge what its owner could do
 * to it anyway.
 */
export function ResourcesSection() {
  const connection = useStore(sessionStore, (state) => state.connection);
  const [step, setStep] = useState<number>(100);
  const [span, setSpan] = useState<number>(1);
  const yours = useStore(sessionStore, (state) => state.yourHouse);
  const idle = connection !== 'open' || yours === null;

  return (
    <Section name="Resources">
      <div className="debug__levers">
        <span className="debug__quiet">by</span>
        {STEPS.map((size) => (
          <button
            type="button"
            key={size}
            className={size === step ? 'debug__button debug__button--on' : 'debug__button'}
            aria-pressed={size === step}
            onClick={() => setStep(size)}
          >
            {size}
          </button>
        ))}
      </div>

      {yours === null ? (
        <p className="debug__quiet">no house yet; found one in World first</p>
      ) : (
        <ul className="debug__stocks">
          {RESOURCES_IN_ORDER.map((name: ResourceName) => (
            <li className="debug__stock" key={name}>
              <span className="debug__stock-name">{RESOURCE_WORDS[name]}</span>
              <span className="debug__stock-figure">{saysStock(yours.resources[name], Date.now())}</span>
              <span className="debug__quiet">{saysRate(yours.resources[name]) ?? ''}</span>
              <button
                type="button"
                className="debug__button"
                disabled={idle}
                title={`give this house ${step} ${RESOURCE_WORDS[name].toLowerCase()}`}
                onClick={() => grantResource(name, step)}
              >
                give
              </button>
              <button
                type="button"
                className="debug__button"
                disabled={idle}
                title={`take ${step} ${RESOURCE_WORDS[name].toLowerCase()} away; refused if that much is not free`}
                onClick={() => spendResource(name, step)}
              >
                take
              </button>
              <button
                type="button"
                className="debug__button"
                disabled={idle}
                title={`tie ${step} ${RESOURCE_WORDS[name].toLowerCase()} up for ${span} months`}
                onClick={() => pledgeResource(name, step, span, 'pledged from the debug panel')}
              >
                pledge
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="debug__levers">
        <span className="debug__quiet">pledging for</span>
        {SPANS.map((months) => (
          <button
            type="button"
            key={months}
            className={months === span ? 'debug__button debug__button--on' : 'debug__button'}
            aria-pressed={months === span}
            onClick={() => setSpan(months)}
          >
            {months} {months === 1 ? 'month' : 'months'}
          </button>
        ))}
      </div>

      {yours !== null && yours.pledges.length > 0 && (
        <ul className="debug__stocks">
          {yours.pledges.map((pledge) => (
            <li className="debug__stock" key={pledge.id}>
              <span className="debug__stock-name">{RESOURCE_WORDS[pledge.resource]}</span>
              <span className="debug__stock-figure">{pledge.amount}</span>
              <button
                type="button"
                className="debug__button"
                disabled={idle}
                title="end this pledge now, which is what its owner could do anyway"
                onClick={() => releasePledge(pledge.id)}
              >
                release
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
