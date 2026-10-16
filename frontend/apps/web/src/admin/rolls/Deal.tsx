import { useState } from 'react';

import { RARITIES, dealFrom } from '@villages/world';
import type { Balance, Fate } from '@villages/world';

/**
 * Omens a roll often reads, to pick from by a press: the house's own, the map's, the season's, and a window of each
 * kind, each said as the omen's key with a stand-in for whatever follows its colon.
 */
const OFTEN = [
  'house.weak',
  'house.pious',
  'house.holdings:the north',
  'change.piety.rose',
  'dialogue.missingWealth',
  'map.river',
  'map.coast',
  'map.ground:forest',
  'map.house:a neighbour',
  'season.winter',
  'window.river:Q548',
  'window.house:a neighbour',
  'window.character:somebody',
  'figure:somebody',
];

/**
 * A deal worked out by hand: omens picked from those a roll often reads, or typed as keys, and what a roll with them
 * would deal from - the pools they open, Hearth always, and for each rarity each action with its weight, how many open
 * pools it is in, and its share of the first draw. The engine's own arithmetic, `dealFrom`, on the page. Picking an
 * omen changes nothing; it only shows. See docs/plans/catalogues.md.
 */
export function Deal({ fate, balance }: { fate: Fate; balance: Balance | null }) {
  const [keys, setKeys] = useState<readonly string[]>(['house.weak', 'house.holdings:the north']);
  const [typed, setTyped] = useState('');
  const { opened, weighed } = dealFrom(fate, keys);
  const toggle = (key: string) =>
    setKeys((held) => (held.includes(key) ? held.filter((one) => one !== key) : [...held, key]));

  return (
    <section className="inspect-group" aria-label="a deal">
      <h2 className="inspect-group__title">a deal, with these omens</h2>
      <p className="inspect-said">
        Pick the omens a roll would read, or type one by its key, and see what it would deal from. Nothing is
        saved.
      </p>
      <ul className="inspect-each">
        {[...new Set([...OFTEN, ...keys])].map((key) => (
          <li key={key}>
            <label className="inspect-pick">
              <input type="checkbox" checked={keys.includes(key)} onChange={() => toggle(key)} /> {key}
            </label>
          </li>
        ))}
        <li>
          <input
            className="inspect-field inspect-field--wide"
            aria-label="An omen by its key"
            placeholder="an omen by its key"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && typed.trim() !== '') {
                toggle(typed.trim());
                setTyped('');
              }
            }}
          />
        </li>
      </ul>
      <p>
        opens <strong>{opened.join(', ')}</strong>
      </p>
      <div className="inspect-scroll">
        <table className="inspect-table">
          <tbody>
            {RARITIES.map((rarity) => (
              <tr key={rarity}>
                <th scope="row">
                  {rarity}
                  {balance !== null && (
                    <span className="inspect-key">{balance.roll.odds[rarity]} in a hundred</span>
                  )}
                </th>
                <td>
                  <ul className="inspect-list">
                    {(weighed.get(rarity) ?? []).map(({ action, weight, share }) => (
                      <li key={action.id}>
                        {Math.round(share * 100)}%{' '}
                        <span className="inspect-key">
                          {action.id}, weight {weight}
                        </span>{' '}
                        {action.label}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
