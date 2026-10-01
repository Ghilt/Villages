import { useState } from 'react';

import { usePictures } from '../../ui/art/pictures';
import type { Showing } from '../../ui/button/Button';
import { Mark } from '../../ui/mark/Mark';
import type { MarkName } from '../../ui/mark/Mark';
import { Meter } from '../../ui/meter/Meter';
import { Slider } from '../../ui/slider/Slider';
import { SLIDER_HEIGHTS } from '../../ui/slider/range';
import type { SliderSize } from '../../ui/slider/range';
import { Stepper } from '../../ui/stepper/Stepper';
import { Part, Specimen, Specimens } from './Specimen';

/** Every state a slider is shown in, side by side. */
const STATES: readonly { readonly name: string; readonly showing?: Showing; readonly disabled?: boolean }[] =
  [
    { name: 'at rest' },
    { name: 'hovered', showing: 'hover' },
    { name: 'pressed', showing: 'pressed' },
    { name: 'focused', showing: 'focus' },
    { name: 'disabled', disabled: true },
  ];

const SIZES = Object.keys(SLIDER_HEIGHTS) as SliderSize[];

/** A key figure's four stats, as the Characters section of the debug panel moves them. */
const STATS: readonly { readonly mark: MarkName; readonly word: string; readonly start: number }[] = [
  { mark: 'piety', word: 'Piety', start: 12 },
  { mark: 'reason', word: 'Reason', start: 9 },
  { mark: 'kindness', word: 'Kindness', start: 15 },
  { mark: 'physical', word: 'Physical', start: 7 },
];

export function Controls() {
  const { list, problem } = usePictures();
  const [taxes, setTaxes] = useState(20);
  const [stats, setStats] = useState(() => STATS.map((stat) => stat.start));
  if (list === null) {
    return <p className="showcase__to-come">{problem ?? 'Reading the pictures…'}</p>;
  }
  return (
    <>
      <Part title="Sliders">
        <p className="ui-label showcase__lead">
          A value set by dragging the knob along the tube, or from the keyboard with the arrows, Page Up and
          Down, Home and End. The tube is lit from its left end as far as the knob.{' '}
          <span className="showcase__said">taxes at {taxes} per cent</span>
        </p>
        <Specimens>
          <Specimen name={'Slider step={5}'} note="drag it, or tab to it and use the arrows" wide>
            <div className="showcase__control-row">
              <Slider
                value={taxes}
                step={5}
                onChange={setTaxes}
                label="Taxes"
                valueText={`${taxes} per cent`}
              />
            </div>
          </Specimen>
          {STATES.map((state) => (
            <Specimen key={state.name} name="Slider" note={state.name}>
              <div className="showcase__control">
                <Slider
                  value={40}
                  onChange={() => undefined}
                  label={state.name}
                  disabled={state.disabled === true}
                  {...(state.showing === undefined ? {} : { showing: state.showing })}
                />
              </div>
            </Specimen>
          ))}
          {SIZES.map((size) => (
            <Specimen key={size} name={`size="${size}"`} note={`${SLIDER_HEIGHTS[size]} pixels tall`}>
              <div className="showcase__control">
                <Slider value={60} onChange={() => undefined} label={size} size={size} />
              </div>
            </Specimen>
          ))}
          <Specimen name="Slider" note={['at either end', 'the knob stops at the ornaments']}>
            <div className="showcase__control showcase__control--stack">
              <Slider value={0} onChange={() => undefined} label="at the start" />
              <Slider value={100} onChange={() => undefined} label="at the end" />
            </div>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Meters">
        <p className="ui-label showcase__lead">
          A level shown and not set, so it has no knob. The first follows the slider above, and glides to
          where it is going.
        </p>
        <Specimens>
          <Specimen name="Meter" note="the taxes, from the slider above" wide>
            <div className="showcase__control-row">
              <span className="showcase__meter-row">
                <span className="ui-label">Taxes</span>
                <Meter value={taxes} label="Taxes" valueText={`${taxes} per cent`} />
                <span className="ui-numeral">{taxes}%</span>
              </span>
            </div>
          </Specimen>
          <Specimen name="Meter" note="as the moodboard’s cathedral has its faith">
            <div className="showcase__control">
              <span className="showcase__meter-row">
                <Mark name="piety" size={17} />
                <Meter value={62} label="Faith" valueText="62 of 100" />
              </span>
            </div>
          </Specimen>
          {[0, 25, 50, 75, 100].map((level) => (
            <Specimen key={level} name={`Meter value={${level}}`}>
              <div className="showcase__control">
                <Meter value={level} label={`${level}`} />
              </div>
            </Specimen>
          ))}
          {[10, 14, 20].map((height) => (
            <Specimen key={height} name={`Meter height={${height}}`}>
              <div className="showcase__control">
                <Meter value={62} label={`${height} pixels tall`} height={height} />
              </div>
            </Specimen>
          ))}
        </Specimens>
      </Part>

      <Part title="Steppers">
        <p className="ui-label showcase__lead">
          A count moved one at a time, as a key figure’s stats are. A mark that would go past either end is
          disabled there, so the end is seen rather than found.
        </p>
        <Specimens>
          <Specimen name="Stepper min={1} max={20}" note="a key figure’s four stats" wide>
            <div className="showcase__stats">
              {STATS.map((stat, at) => (
                <span key={stat.word} className="showcase__stat">
                  <Mark name={stat.mark} size={17} />
                  <span className="showcase__stat-word">{stat.word}</span>
                  <Stepper
                    value={stats[at]!}
                    min={1}
                    max={20}
                    onChange={(value) =>
                      setStats((was) => was.map((one, which) => (which === at ? value : one)))
                    }
                    label={stat.word}
                  />
                </span>
              ))}
            </div>
          </Specimen>
          <Specimen name="Stepper" note="at the bottom">
            <Stepper value={1} min={1} max={20} onChange={() => undefined} label="Piety" />
          </Specimen>
          <Specimen name="Stepper" note="at the top">
            <Stepper value={20} min={1} max={20} onChange={() => undefined} label="Piety" />
          </Specimen>
          <Specimen name={'Stepper size="regular"'} note="larger, where there is room">
            <Stepper value={12} min={1} max={20} onChange={() => undefined} label="Piety" size="regular" />
          </Specimen>
        </Specimens>
      </Part>

      <p className="showcase__to-come">
        The switch, a choice of a few, and hold to confirm arrive with the second half of step 7.
      </p>
    </>
  );
}
