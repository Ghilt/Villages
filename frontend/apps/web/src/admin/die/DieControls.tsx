import { useState } from 'react';

import { FLIGHT } from '../../sprites/die/flight';
import type { FlightFeel } from '../../sprites/die/flight';
import { FEEL } from '../../sprites/die/physics';
import type { DieFeel } from '../../sprites/die/physics';

import type { DieSettings, Rested } from './dieStage';

/**
 * The spike's sliders: how the die flies, how it moves on the ground, how a hand throws it, how it is drawn, what comes up on top, how wide its
 * ring is, and two switches. What they are left at can be copied as one block of numbers, so a feel found here can be
 * written into the game as it was found.
 */

export const FIRST_DRAFT: DieSettings = {
  feel: FEEL,
  flight: FLIGHT,
  look: { size: 44, landedWide: 2, hang: 56, ownAngle: 35 },
  juice: true,
  striking: false,
  showing: 6,
  circleKm: 25,
  throwsFrom: 300,
};

interface Slider<Key extends string> {
  readonly key: Key;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

const FLIGHT_SLIDERS: readonly Slider<keyof FlightFeel>[] = [
  { key: 'carries', label: 'carries, seconds of the flick', min: 0.1, max: 1.5, step: 0.01 },
  { key: 'farthest', label: 'carries at most, px', min: 100, max: 3000, step: 50 },
  { key: 'arcs', label: 'arcs as high as, of its length', min: 0, max: 0.8, step: 0.01 },
  { key: 'fallsIn', label: 'a drop falls in, seconds', min: 0.1, max: 1, step: 0.01 },
  { key: 'grows', label: 'grows as it rises', min: 0, max: 1.2, step: 0.01 },
  { key: 'shrinks', label: 'shrinks after the top of its arc', min: 1, max: 4, step: 0.05 },
  { key: 'marksBelow', label: 'far out, a mark once smaller than, px', min: 1, max: 14, step: 0.5 },
  { key: 'slows', label: 'slows as it nears the ground', min: 1, max: 3, step: 0.05 },
  { key: 'landsFlat', label: 'comes down flatter', min: 1, max: 3.5, step: 0.05 },
  { key: 'rollsOn', label: 'speed kept as it strikes, of its mean', min: 0, max: 1, step: 0.01 },
  { key: 'rollsAtMost', label: 'rolls on at most, px a second', min: 0, max: 600, step: 5 },
  { key: 'strikesFrom', label: 'strikes as from, share of its arc', min: 0, max: 1, step: 0.01 },
  { key: 'strikesAtMost', label: 'strikes as from at most, px', min: 5, max: 300, step: 5 },
  { key: 'fromHigh', label: 'harder from high, a halving of its size', min: 0, max: 2, step: 0.05 },
  { key: 'pulls', label: 'pulls on the ground, px a second²', min: 50, max: 1500, step: 10 },
];

const FEEL_SLIDERS: readonly Slider<keyof DieFeel>[] = [
  { key: 'bounce', label: 'bounce', min: 0, max: 0.9, step: 0.01 },
  { key: 'friction', label: 'friction', min: 0, max: 1.5, step: 0.01 },
  { key: 'rolling', label: 'spin kept a 240th of a second', min: 0.95, max: 1, step: 0.001 },
  { key: 'sliding', label: 'speed kept a 240th of a second on it', min: 0.9, max: 1, step: 0.001 },
  { key: 'spin', label: 'rolls as it strikes', min: 0, max: 1.5, step: 0.01 },
];

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="die-controls__range">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output>{value}</output>
    </label>
  );
}

function said(rested: Rested): string {
  return [
    `${rested.how}${rested.how === 'thrown' ? ` at ${Math.round(rested.speed)} px/s` : ''}`,
    `flew ${Math.round(rested.flew)} px and rested ${Math.round(rested.away)} px from where it was let go`,
    `at ${rested.lat.toFixed(4)}, ${rested.lon.toFixed(4)}`,
    `after ${rested.seconds.toFixed(2)} s`,
    `worked out in ${rested.workedOutMs.toFixed(2)} ms, ${rested.steps} steps`,
    `came up ${rested.came}${rested.settled ? '' : ', laid flat when time ran out'}`,
  ].join(' · ');
}

export function DieControls({
  settings,
  onChange,
  rested,
  onPlant,
}: {
  settings: DieSettings;
  onChange: (settings: DieSettings) => void;
  rested: Rested | null;
  onPlant: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const feel = (key: keyof DieFeel, value: number) =>
    onChange({ ...settings, feel: { ...settings.feel, [key]: value } });
  const flight = (key: keyof FlightFeel, value: number) =>
    onChange({ ...settings, flight: { ...settings.flight, [key]: value } });

  return (
    <aside className="die-controls">
      <p className="die-controls__rested inspect-note">
        {rested === null ? 'Not thrown yet.' : said(rested)}
      </p>

      <fieldset>
        <legend>How it flies</legend>
        {FLIGHT_SLIDERS.map(({ key, label, min, max, step }) => (
          <Range
            key={key}
            label={label}
            min={min}
            max={max}
            step={step}
            value={settings.flight[key]}
            onChange={(value) => flight(key, value)}
          />
        ))}
      </fieldset>

      <fieldset>
        <legend>How it moves on the ground</legend>
        {FEEL_SLIDERS.map(({ key, label, min, max, step }) => (
          <Range
            key={key}
            label={label}
            min={min}
            max={max}
            step={step}
            value={settings.feel[key]}
            onChange={(value) => feel(key, value)}
          />
        ))}
      </fieldset>

      <fieldset>
        <legend>The hand and the look</legend>
        <Range
          label="throws from, px a second"
          value={settings.throwsFrom}
          min={50}
          max={1500}
          step={10}
          onChange={(throwsFrom) => onChange({ ...settings, throwsFrom })}
        />
        <Range
          label="in the hand, px"
          value={settings.look.size}
          min={24}
          max={96}
          step={1}
          onChange={(size) => onChange({ ...settings, look: { ...settings.look, size } })}
        />
        <Range
          label="hangs above its shadow, px"
          value={settings.look.hang}
          min={0}
          max={200}
          step={1}
          onChange={(hang) => onChange({ ...settings, look: { ...settings.look, hang } })}
        />
        <Range
          label="on the ground, world units wide"
          value={settings.look.landedWide}
          min={0.5}
          max={6}
          step={0.1}
          onChange={(landedWide) => onChange({ ...settings, look: { ...settings.look, landedWide } })}
        />
        <label className="die-controls__choice">
          <span>its height drawn</span>
          <select
            value={settings.look.ownAngle === null ? 'grows' : 'angle'}
            onChange={(e) =>
              onChange({
                ...settings,
                look: { ...settings.look, ownAngle: e.target.value === 'grows' ? null : 35 },
              })
            }
          >
            <option value="angle">at the map&apos;s tilt, never flatter than</option>
            <option value="grows">at the map&apos;s tilt alone</option>
          </select>
        </label>
        {settings.look.ownAngle !== null && (
          <Range
            label="never flatter than, degrees"
            value={settings.look.ownAngle}
            min={10}
            max={70}
            step={1}
            onChange={(ownAngle) => onChange({ ...settings, look: { ...settings.look, ownAngle } })}
          />
        )}
      </fieldset>

      <fieldset>
        <legend>What it reads and shows</legend>
        <label className="die-controls__choice">
          <span>comes up</span>
          <select
            value={settings.showing ?? 'any'}
            onChange={(e) =>
              onChange({ ...settings, showing: e.target.value === 'any' ? null : Number(e.target.value) })
            }
          >
            <option value="any">whatever the throw leaves on top</option>
            {[1, 2, 3, 4, 5, 6].map((number) => (
              <option key={number} value={number}>
                {number}, every time
              </option>
            ))}
          </select>
        </label>
        <Range
          label="landing circle, km"
          value={settings.circleKm}
          min={2}
          max={100}
          step={1}
          onChange={(circleKm) => onChange({ ...settings, circleKm })}
        />
        <label className="die-controls__check">
          <input
            type="checkbox"
            checked={settings.juice}
            onChange={(e) => onChange({ ...settings, juice: e.target.checked })}
          />
          juice: a squash as it strikes, dust, and the ring flaring as it rests
        </label>
        <label className="die-controls__check">
          <input
            type="checkbox"
            checked={settings.striking}
            onChange={(e) => onChange({ ...settings, striking: e.target.checked })}
          />
          striking a wood and three houses, stand-ins at the map&apos;s own sizes
        </label>
        <button type="button" className="die-controls__button" onClick={onPlant}>
          stand them round the middle of the view
        </button>
      </fieldset>

      <div className="die-controls__keep">
        <button
          type="button"
          className="die-controls__button"
          onClick={() => {
            void navigator.clipboard.writeText(JSON.stringify(settings, null, 2)).then(() => setCopied(true));
          }}
        >
          {copied ? 'copied' : 'copy the numbers'}
        </button>
        <button type="button" className="die-controls__button" onClick={() => onChange(FIRST_DRAFT)}>
          back to the first draft
        </button>
      </div>
    </aside>
  );
}
