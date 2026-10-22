import type { SliceView } from '@villages/protocol';
import type { Challenges } from '@villages/world';

import { List, ListRow } from '../ui/list/List';
import { TugChart } from '../ui/replay/TugChart';
import { AspectDisc } from '../ui/slice/Slice';
import { STATE_WORDS } from '../ui/slice/sliceWords';
import type { Field, Run, SideKey } from './replay';
import { aspectName, aspectShown, momentSaid, numberSaid, summonNames } from './said';
import type { HouseShown } from './said';

const SIDES: readonly SideKey[] = ['a', 'b'];

/** A change to the tug as the history says it, toward the first side up: `+3`, `−7.5`. */
const deltaSaid = (delta: number) =>
  delta === 0 ? '' : `${delta > 0 ? '+' : '−'}${numberSaid(Math.abs(delta))}`;

/**
 * A challenge's history, as its drawer holds it: the tug second by second as far as it has been played, the second shown
 * marked, what happened
 * in that second in words - the same words the inspect page's table of moments says - and every slice's numbers and
 * state. Decision record 0116.
 */
export function History({
  run,
  tug,
  seen,
  field,
  sides,
  content,
  houses,
}: {
  run: Run;
  tug: readonly number[];
  /** The furthest second played to; the chart stops there. */
  seen: number;
  field: Field;
  sides: Readonly<Record<SideKey, readonly SliceView[]>>;
  content: Challenges;
  houses: Readonly<Record<SideKey, HouseShown>>;
}) {
  const called = summonNames(run.summons, content);
  return (
    <div className="spectacle-history">
      <TugChart tug={tug} second={field.second} seen={seen} first={houses.a} other={houses.b} />
      <h4 className="ui-caps spectacle-history__heading">
        second {field.second} · {field.happening.aspects.map(aspectName).join(' and ')}
      </h4>
      {field.moments.length === 0 ? (
        <p className="ui-label">Nothing happened in this second.</p>
      ) : (
        <List label={`What happened in second ${field.second}`}>
          {field.moments.map((moment, at) => (
            <ListRow
              key={`${moment.actor}-${moment.what}-${at}`}
              lead={
                <span className="ui-label spectacle-history__side">
                  {moment.side === null ? '' : houses[moment.side].name}
                </span>
              }
              title={<span className="ui-body">{momentSaid(moment, sides, called, content)}</span>}
              trail={<span className="ui-numeral ui-body">{deltaSaid(moment.tugDelta)}</span>}
            />
          ))}
        </List>
      )}
      <h4 className="ui-caps spectacle-history__heading">slices</h4>
      <List label="Every slice">
        {SIDES.flatMap((side) =>
          field.slices[side].map((slice) => {
            const view = sides[side][slice.index];
            return (
              <ListRow
                key={slice.actor}
                lead={<AspectDisc aspect={aspectShown(slice.aspect)} size={24} />}
                title={
                  <span className="ui-body">
                    {houses[side].name} · {aspectName(slice.aspect)}
                  </span>
                }
                line={
                  view === undefined
                    ? STATE_WORDS[slice.state]
                    : `power ${view.power}, integrity ${view.integrity}, ${STATE_WORDS[slice.state]}`
                }
              />
            );
          }),
        )}
      </List>
    </div>
  );
}
