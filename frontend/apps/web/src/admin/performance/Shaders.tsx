import { useEffect, useState } from 'react';

import { Fold } from './Fold';
import { LineChart } from './LineChart';
import { FAMILIES, byFamily, lineOf, pointName, readShaderPoints } from './shaderPoints';
import type { Family, KeptPlace, Point } from './shaderPoints';

/** A colour a place, told apart on the page's paper; the legend and the tables name them too. */
const PLACE_COLOURS = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#b04ac0',
  '#c4373b',
  '#8a7a1f',
  '#1f9fb0',
  '#d17fb0',
  '#555555',
  '#6250d6',
];

type Reading =
  | { state: 'reading' }
  | { state: 'read'; points: readonly Point[]; unreadable: number }
  | { state: 'unread'; problem: string };

const ms = (value: number) => value.toFixed(2);
const drawsOf = (place: KeptPlace) => Object.values(place.draws).reduce((sum, n) => sum + n, 0);

/**
 * What the shaders cost the graphics card, point by point: the history `npm run perf:shaders` keeps, read from
 * `docs/experiments/performance/shaders.jsonl`. The latest point's places and what drew in each, then each place's
 * frame point by point, and one place by what drew; only points measured as the latest was - one method, one card,
 * one size - are drawn as a line. See decision record 0106.
 */
export function Shaders() {
  const [reading, setReading] = useState<Reading>({ state: 'reading' });
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    fetch('/performance/shaders.jsonl')
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`${response.status}`))))
      .then((text) => setReading({ state: 'read', ...readShaderPoints(text) }))
      .catch((problem: unknown) =>
        setReading({ state: 'unread', problem: `could not read the points: ${String(problem)}` }),
      );
  }, []);

  const points = reading.state === 'read' ? reading.points : [];
  const line = lineOf(points);
  const latest = line.at(-1);
  const place = chosen ?? latest?.places[0]?.name ?? null;

  return (
    <Fold
      title="What the shaders cost"
      aside={
        <>
          from docs/experiments/performance/shaders.jsonl
          {reading.state === 'read' && `, ${points.length} ${points.length === 1 ? 'point' : 'points'}`}
          {points.length > line.length && `, ${points.length - line.length} measured otherwise and not drawn`}
          {reading.state === 'read' &&
            reading.unreadable > 0 &&
            `, ${reading.unreadable} lines that are not points`}
        </>
      }
    >
      {reading.state === 'reading' && <p className="inspect-quiet">reading the points</p>}
      {reading.state === 'unread' && <p className="inspect-problem">{reading.problem}</p>}
      {reading.state === 'read' && latest === undefined && (
        <p className="inspect-quiet">
          No point yet. One is `npm run perf:shaders --prefix frontend -- --record`.
        </p>
      )}
      {latest !== undefined && (
        <>
          <Latest point={latest} />
          <ByPlace line={line} />
          {place !== null && <OnePlace line={line} place={place} choose={setChosen} />}
          <details className="inspect-whole">
            <summary>every thing the latest point timed, place by place</summary>
            <Parts point={latest} />
          </details>
        </>
      )}
    </Fold>
  );
}

/** The families that drew anything at any of the places. */
function familiesIn(places: readonly KeptPlace[]): (typeof FAMILIES)[number][] {
  return FAMILIES.filter((family) => places.some((place) => byFamily(place.keys)[family.name] >= 0.005));
}

function Latest({ point }: { point: Point }) {
  const families = familiesIn(point.places);
  return (
    <section className="inspect-group" aria-label="the latest point">
      <p className="inspect-said">
        Milliseconds of the graphics card a frame, every shader at high, {point.machine.viewport} on the{' '}
        {point.machine.gpu}, a screen each of one kind of ground: the latest point, {pointName(point)}, &quot;
        {point.code.subject}&quot;, {point.why}. The frame is the fastest fifth of frames on the fastest of
        three fresh pages; its parts are what drew in it. A place&apos;s name opens the game there.
        {point.fogMissed !== null && ` The fog was not measured: ${point.fogMissed}.`}
      </p>
      <table className="inspect-table perf-table">
        <thead>
          <tr>
            <th>place</th>
            <th>frame ms</th>
            <th title="the middle frame and the eightieth percentile">p50/p80</th>
            <th title="the CPU's milliseconds for the middle frame">cpu ms</th>
            {families.map((family) => (
              <th key={family.name} title={family.what}>
                {family.name}
              </th>
            ))}
            <th>draws a frame</th>
          </tr>
        </thead>
        <tbody>
          {point.places.map((place) => {
            const gathered = byFamily(place.keys);
            return (
              <tr key={place.name}>
                <td>
                  <a href={`/?at=${place.lat},${place.lon}&zoom=${place.zoom}`}>{place.name}</a>
                  {place.settled ? '' : ' (never settled)'}
                </td>
                <td>{ms(place.frame)}</td>
                <td>
                  {ms(place.p50)}/{ms(place.p80)}
                </td>
                <td>{ms(place.cpu)}</td>
                {families.map((family) => (
                  <td
                    key={family.name}
                    className={gathered[family.name] < 0.005 ? 'perf-table__none' : undefined}
                  >
                    {gathered[family.name] < 0.005 ? '-' : ms(gathered[family.name])}
                  </td>
                ))}
                <td>{Math.round(drawsOf(place))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function ByPlace({ line }: { line: readonly Point[] }) {
  const names = [...new Set(line.flatMap((point) => point.places.map((place) => place.name)))];
  return (
    <section className="inspect-group" aria-label="each place, point by point">
      <h3 className="inspect-group__title">Each place, point by point</h3>
      <p className="inspect-said">
        A place&apos;s frame from one point to the next; a step up is a change that cost something there. The
        fog&apos;s frame is over another seat every run: only its own part compares, below.
      </p>
      <LineChart
        label="each place's frame, point by point"
        labels={line.map(pointName)}
        captions={line.map((point) => point.code.subject)}
        unit="ms"
        series={names.map((name, index) => ({
          name,
          colour: PLACE_COLOURS[index % PLACE_COLOURS.length]!,
          values: line.map((point) => point.places.find((place) => place.name === name)?.frame ?? null),
        }))}
      />
    </section>
  );
}

function OnePlace({
  line,
  place,
  choose,
}: {
  line: readonly Point[];
  place: string;
  choose: (place: string) => void;
}) {
  const at = line.map((point) => point.places.find((each) => each.name === place) ?? null);
  const families = familiesIn(at.filter((each): each is KeptPlace => each !== null));
  const names = [...new Set(line.flatMap((point) => point.places.map((each) => each.name)))];
  return (
    <section className="inspect-group" aria-label="one place, by what drew">
      <h3 className="inspect-group__title">
        One place, by what drew{' '}
        <select className="perf-pick" value={place} onChange={(event) => choose(event.target.value)}>
          {names.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </h3>
      <LineChart
        label={`${place}, by what drew, point by point`}
        labels={line.map(pointName)}
        captions={line.map((point) => point.code.subject)}
        unit="ms"
        series={families.map((family) => ({
          name: family.name,
          colour: family.colour,
          values: at.map((each) =>
            each === null ? null : round(byFamily(each.keys)[family.name as Family]),
          ),
        }))}
      />
    </section>
  );
}

const round = (value: number) => Math.round(value * 1000) / 1000;

function Parts({ point }: { point: Point }) {
  return (
    <table className="inspect-table perf-table">
      <thead>
        <tr>
          <th>place</th>
          <th>what drew</th>
          <th>family</th>
          <th>ms</th>
          <th>draws a frame</th>
        </tr>
      </thead>
      <tbody>
        {point.places.flatMap((place) =>
          [...new Set([...Object.keys(place.keys), ...Object.keys(place.draws)])]
            .sort((a, b) => (place.keys[b] ?? 0) - (place.keys[a] ?? 0))
            .map((key) => (
              <tr key={`${place.name} ${key}`}>
                <td>{place.name}</td>
                <td>{key}</td>
                <td>{familyName(key)}</td>
                <td>{place.keys[key] === undefined ? '-' : ms(place.keys[key])}</td>
                <td>{place.draws[key] ?? '-'}</td>
              </tr>
            )),
        )}
      </tbody>
    </table>
  );
}

function familyName(key: string): string {
  return FAMILIES.find((family) => byFamily({ [key]: 1 })[family.name] > 0)?.name ?? '';
}
