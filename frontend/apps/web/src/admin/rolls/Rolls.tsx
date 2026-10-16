import { RARITIES, parseBalance, parseFate } from '@villages/world';
import type { Balance, Fate, FateAction } from '@villages/world';

import { ListField, NumberField, WordsField } from '../frame/Fields';
import { InspectPage } from '../frame/InspectPage';
import { SaveBar, WholeFile } from '../frame/SaveBar';
import { useCatalogue } from '../frame/useCatalogue';
import { useCatalogueEditor } from '../frame/useCatalogueEditor';
import type { CatalogueEditor } from '../frame/useCatalogueEditor';
import { Deal } from './Deal';

/** The resources as the page says them. */
const SAID: Record<string, string> = {
  wealth: 'wealth',
  naturalDomain: 'domain',
  influence: 'influence',
  reason: 'reason',
  piety: 'piety',
};

/**
 * The choice roll's content, `world/catalogues/fate.json`: the pools and what opens each, the actions by rarity with
 * their pools and words and what each deals, and the balance's odds and grants beside them, read from
 * `balance.json`. Every pattern, pool list, word and number of gossip is changed in place and saved through the game
 * server, which takes it on at once: the next roll deals from what was saved. Below, omens picked by hand show which
 * pools they open and each action's share of the deal. See docs/plans/catalogues.md and decision record 0097.
 */
export function Rolls() {
  const editor = useCatalogueEditor('fate.json', parseFate);
  const balance = useCatalogue('balance.json', parseBalance);
  const fate = editor.value;
  const numbers = balance.state === 'read' ? balance.shelved.value : null;
  return (
    <InspectPage
      title="Rolls"
      bar={
        <span className="inspect-note">
          {fate === null ? '' : `${fate.pools.length} pools, ${fate.actions.length} actions `}from
          world/catalogues/fate.json
        </span>
      }
    >
      <SaveBar editor={editor} />
      {editor.reading.state === 'reading' && (
        <p className="inspect-quiet">reading world/catalogues/fate.json</p>
      )}
      {editor.reading.state === 'unread' && <p className="inspect-problem">{editor.reading.problem}</p>}
      {fate !== null && (
        <>
          {fate.said[''] !== '' && <p className="inspect-said">{fate.said['']}</p>}
          <Pools editor={editor} fate={fate} />
          <Actions editor={editor} fate={fate} balance={numbers} />
          <Deal fate={fate} balance={numbers} />
        </>
      )}
      <WholeFile editor={editor} />
    </InspectPage>
  );
}

function Pools({ editor, fate }: { editor: CatalogueEditor<Fate>; fate: Fate }) {
  return (
    <section className="inspect-group" aria-label="pools">
      <h2 className="inspect-group__title">pools</h2>
      {fate.said.pools !== '' && <p className="inspect-said">{fate.said.pools}</p>}
      <table className="inspect-table">
        <thead>
          <tr>
            <th>pool</th>
            <th>opens on</th>
            <th>actions in it</th>
          </tr>
        </thead>
        <tbody>
          {fate.pools.map((pool) => (
            <tr key={pool.name}>
              <th scope="row">{pool.name}</th>
              <td>
                {pool.name === 'Hearth' ? (
                  <span className="inspect-quiet">always open</span>
                ) : (
                  <ListField
                    editor={editor}
                    path={['pools', pool.name]}
                    label={`${pool.name} opens on`}
                    wide
                  />
                )}
              </td>
              <td>{fate.actions.filter((action) => action.pools.includes(pool.name)).length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Actions({
  editor,
  fate,
  balance,
}: {
  editor: CatalogueEditor<Fate>;
  fate: Fate;
  balance: Balance | null;
}) {
  return (
    <section className="inspect-group" aria-label="actions">
      <h2 className="inspect-group__title">actions</h2>
      {fate.said.actions !== '' && <p className="inspect-said">{fate.said.actions}</p>}
      {RARITIES.map((rarity) => (
        <div key={rarity} className="inspect-scroll">
          <h3 className="inspect-group__subtitle">
            {rarity}
            {balance !== null && (
              <span className="inspect-key">
                {' '}
                {balance.roll.odds[rarity]} in a hundred, each granting {balance.roll.grants[rarity]}
              </span>
            )}
          </h3>
          <table className="inspect-table">
            <tbody>
              {fate.actions
                .filter((action) => action.rarity === rarity)
                .map((action) => (
                  <ActionRow key={action.id} editor={editor} action={action} />
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

function ActionRow({ editor, action }: { editor: CatalogueEditor<Fate>; action: FateAction }) {
  const at = ['actions', action.id] as const;
  return (
    <tr>
      <th scope="row">
        <span className="inspect-key">{action.id}</span>
      </th>
      <td>
        <ListField editor={editor} path={[...at, 'pools']} label={`${action.id} pools`} />
      </td>
      <td>
        <WordsField editor={editor} path={[...at, 'label']} label={`${action.id} label`} wide />
        <br />
        <WordsField editor={editor} path={[...at, 'detail']} label={`${action.id} detail`} wide />
      </td>
      <td>
        {action.deals.kind === 'grant' ? (
          `grants ${SAID[action.deals.resource] ?? action.deals.resource}`
        ) : (
          <ul className="inspect-list">
            <li>
              gossip within{' '}
              <NumberField
                editor={editor}
                path={[...at, 'gossip', 'heardOfKm']}
                label={`${action.id} heard of, km`}
              />{' '}
              km
            </li>
            <li>
              spread for{' '}
              <NumberField
                editor={editor}
                path={[...at, 'gossip', 'spreads']}
                label={`${action.id} spreads`}
              />{' '}
              influence
            </li>
            <li>{action.deals.rumours.length} rumours, in the whole file</li>
          </ul>
        )}
      </td>
    </tr>
  );
}
