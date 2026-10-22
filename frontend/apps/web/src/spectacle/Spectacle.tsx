import './spectacle.css';

import { useMemo, useState } from 'react';

import type { SliceView } from '@villages/protocol';
import { ASPECTS } from '@villages/world';
import type { Aspect, Challenges } from '@villages/world';

import { MarkButton } from '../ui/button/Button';
import { Channels } from '../ui/diorama/Channels';
import { Diorama } from '../ui/diorama/Diorama';
import { Drawer } from '../ui/drawer/Drawer';
import { ReplayBar } from '../ui/replay/Replay';
import type { Band, Tick } from '../ui/replay/Replay';
import { useReplayClock } from '../ui/replay/useReplayClock';
import { SliceChip, SliceTray } from '../ui/slice/Slice';
import { TugBar } from '../ui/tug/Tug';
import { towardSaid } from '../ui/tug/tugShare';
import { History } from './History';
import { joltAt, joltColour } from './jolt';
import { openedOf, stateSaid } from './opened';
import { replayOf, startsOf } from './replay';
import type { Field, Run, SideKey, SliceNow } from './replay';
import { aspectName, aspectShown, boostSaid, borneOf } from './said';
import type { HouseShown } from './said';
import { sealsPlaced } from './seals';
import { useSheets } from './sheets';
import { standingOf } from './standing';
import { SQUARE } from './venues/square';

export type { HouseShown } from './said';

/** Which way a stage is held: wide, its banks side by side, or deep, its ranks one behind another. */
export type Held = 'wide' | 'deep';

const SIDES: readonly SideKey[] = ['a', 'b'];

const isAspect = (name: string): name is Aspect => (ASPECTS as readonly string[]).includes(name);

/**
 * The seconds before the first that a run is watched from, so the first happening is seen coming: the time its seal
 * forms in the mist and comes along its path.
 */
const APPROACH = -6;

/** The field before a challenge begins: nobody on it, the tug even, nothing done, and no slice yet working. */
function beforeItBegins(first: Field): Field {
  return {
    ...first,
    tug: 0,
    standing: [],
    pulled: new Map(),
    moments: [],
    slices: {
      a: first.slices.a.map((slice) => ({ ...slice, state: 'idle', bearing: [] })),
      b: first.slices.b.map((slice) => ({ ...slice, state: 'idle', bearing: [] })),
    },
  };
}

/**
 * A challenge's spectacle: a run played out in a venue - the square - seen as the map sees it, the two houses on their
 * banks, the townsfolk walking to whoever is winning them, the summons arriving, acting and falling, and each happening
 * a seal coming out of the mist along the channels to the font, jolting the slices it lights as it arrives; over it the
 * tug, along the bottom each house's slices in its tray and the replay. Everything shown is the run
 * folded to the second shown, so a second scrubbed back to is the same as one played to. Built of the library's
 * parts. Decision record 0116.
 */
export function Spectacle({
  run,
  sides,
  content,
  houses,
  held = 'wide',
}: {
  run: Run;
  /** The slices each side brought, as the page sent them. */
  sides: Readonly<Record<SideKey, readonly SliceView[]>>;
  content: Challenges;
  houses: Readonly<Record<SideKey, HouseShown>>;
  held?: Held;
}) {
  const replay = useMemo(() => replayOf(run, sides, content), [run, sides, content]);
  const clock = useReplayClock(replay.last, { start: APPROACH, first: APPROACH, autoplay: 900 });
  const field = clock.second < 0 ? beforeItBegins(replay.at(0)) : replay.at(clock.second);
  const sheets = useSheets();
  const [open, setOpen] = useState<Record<SideKey, boolean>>({ a: true, b: true });
  const [opened, setOpened] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const arrangement = held === 'wide' ? SQUARE.wide : SQUARE.deep;
  const boost = boostSaid(content);
  const starts = startsOf(run.progression);
  const bands: Band[] = run.progression.happenings.map((aspects, at) => ({
    from: starts[at] ?? 0,
    to: starts[at + 1] ?? run.progression.seconds,
    name: aspects.map(aspectName).join(' and '),
    colours: aspects.map((aspect) => `var(--ui-aspect-${aspect})`),
  }));
  const ticks: Tick[] = run.moments
    .filter((moment) => moment.what === 'summoned' || moment.what === 'arrived' || moment.what === 'killed')
    .map((moment) => ({
      second: moment.second,
      kind: moment.what === 'killed' ? 'fell' : 'arrived',
      said:
        moment.what === 'killed'
          ? `${moment.target ?? ''} falls`
          : `${moment.target ?? moment.actor} arrives`,
    }));
  const drawn =
    sheets === null || sheets === 'missing'
      ? { pictures: [], placed: [] }
      : standingOf(field, arrangement, sheets, sides, houses, content);
  const happenings = run.progression.happenings.map((aspects) => aspects.filter(isAspect));
  const jolt = joltAt(clock.second, starts, field);
  const chipJolt = (slice: SliceNow) => {
    const colour = joltColour(slice);
    return jolt === undefined || colour === null ? {} : { jolt: { key: jolt.key, colour } };
  };
  return (
    <div className={`ui-root spectacle spectacle--${held}`}>
      <div className="spectacle__stage">
        <Diorama
          scene={arrangement.scene}
          ground={
            <>
              {arrangement.ground}
              <Channels scene={arrangement.scene} paths={[arrangement.path]} />
            </>
          }
          pictures={drawn.pictures}
          placed={[...drawn.placed, ...sealsPlaced(clock.second, starts, happenings, arrangement)]}
          label={`${SQUARE.name}, second ${field.second}`}
        />
      </div>
      {sheets === 'missing' && (
        <p className="spectacle__missing ui-label">
          The map’s sheets are not cut in this tree: npm run world:art.
        </p>
      )}
      <div className="spectacle__top">
        <TugBar
          first={houses.a}
          second={houses.b}
          tug={field.tug}
          said={towardSaid(field.tug, houses.a.name, houses.b.name)}
        />
      </div>
      <div className="spectacle__history">
        <MarkButton
          label="The history"
          mark="history"
          pressed={history}
          onClick={() => setHistory(!history)}
        />
      </div>
      <div className="spectacle__trays">
        {SIDES.map((side) => (
          <SliceTray
            key={side}
            house={houses[side].name}
            colour={houses[side].colour}
            open={open[side]}
            onToggle={() => setOpen({ ...open, [side]: !open[side] })}
            direction={held === 'wide' ? 'row' : 'column'}
            align={side === 'a' ? 'start' : 'end'}
            opened={openedOf(field, side, sides, content, houses, opened, boost, () => setOpened(null))}
          >
            {field.slices[side].map((slice) => (
              <SliceChip
                key={slice.actor}
                aspect={aspectShown(slice.aspect)}
                state={slice.state}
                said={stateSaid(slice, boost)}
                borne={borneOf(slice.bearing, content, field.second)}
                chosen={opened === slice.actor}
                {...chipJolt(slice)}
                onPress={() => setOpened(opened === slice.actor ? null : slice.actor)}
              />
            ))}
          </SliceTray>
        ))}
      </div>
      <div className="spectacle__replay">
        <ReplayBar
          second={clock.second}
          last={replay.last}
          playing={clock.playing}
          pace={clock.pace}
          onPlay={clock.play}
          onPause={clock.pause}
          onQuicken={clock.quicken}
          onShow={clock.show}
          onToEnd={clock.toEnd}
          seen={clock.seen}
          bands={bands}
          tug={replay.tug}
          ticks={ticks}
        />
      </div>
      <Drawer
        title="History"
        open={history}
        onClose={() => setHistory(false)}
        from={held === 'wide' ? 'right' : 'bottom'}
      >
        <History
          run={run}
          tug={replay.tug}
          seen={clock.seen}
          field={field}
          sides={sides}
          content={content}
          houses={houses}
        />
      </Drawer>
    </div>
  );
}
