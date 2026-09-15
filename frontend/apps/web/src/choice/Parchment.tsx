import { useEffect, useState, useSyncExternalStore } from 'react';

import type { ChoiceView, OptionView } from '@villages/protocol';

import { gatewayState, takeOption, watchGateway } from '../net/gateway';

const FOLDED_KEY = 'villages.parchment.folded';

/** Whether the parchment was folded away last time. A browser that will not remember is not a failure. */
function wasFolded(): boolean {
  try {
    return localStorage.getItem(FOLDED_KEY) === 'yes';
  } catch {
    return false;
  }
}

function rememberFolded(folded: boolean): void {
  try {
    localStorage.setItem(FOLDED_KEY, folded ? 'yes' : 'no');
  } catch {
    // Not remembering it is a smaller problem than not showing it.
  }
}

/**
 * A choice, put to the player as a sheet lying over the map.
 *
 * It renders whatever the choice says and knows nothing else about it: the prompt, and one button an
 * option. That is what lets a new kind of choice arrive with no change here at all. See 0034.
 *
 * It folds to a corner rather than closing, because the map is the thing being decided about and a
 * player will want to look at it before answering. A new choice unfolds it: the world has asked
 * something new and hiding that would be the interface lying by omission.
 */
export function Parchment() {
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const [folded, setFolded] = useState(wasFolded);
  const choice = heard.yourChoice;
  const asked = choice?.id;

  useEffect(() => {
    if (asked !== undefined) {
      setFolded(false);
    }
  }, [asked]);

  if (choice === null) {
    return null;
  }

  const fold = (away: boolean) => {
    setFolded(away);
    rememberFolded(away);
  };

  if (folded) {
    return (
      <button type="button" className="parchment parchment--folded" onClick={() => fold(false)}>
        A letter awaits
      </button>
    );
  }

  const answering = heard.acting !== null;

  return (
    <section className="parchment" aria-live="polite">
      <header className="parchment__head">
        <h2 className="parchment__prompt">{choice.prompt}</h2>
        <button type="button" className="parchment__fold" onClick={() => fold(true)}>
          set aside
        </button>
      </header>
      <ol className="parchment__options">
        {choice.options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              className="parchment__option"
              disabled={answering || heard.connection !== 'open'}
              onClick={() => take(choice, option)}
            >
              <span className="parchment__label">{option.label}</span>
              <span className="parchment__detail">{option.detail}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function take(choice: ChoiceView, option: OptionView): void {
  takeOption(choice, option);
}
