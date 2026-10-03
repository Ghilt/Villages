/**
 * A column of sliders, each with its label above and what it says under it: how a part of the debug panel lays out
 * numbers that are a matter of taste, the rivers' and the grass's alike.
 */
export interface SliderDef<Key extends string> {
  key: Key;
  label: string;
  min: number;
  max: number;
  step: number;
  /** The value as the line under the slider says it. */
  say: (value: number) => string;
}

interface SlidersProps<Key extends string> {
  /** What the sliders' ids begin with, so two columns on the page never share one. */
  idPrefix: string;
  sliders: readonly SliderDef<Key>[];
  values: Record<Key, number>;
  onChange: (change: Partial<Record<Key, number>>) => void;
}

export function Sliders<Key extends string>({ idPrefix, sliders, values, onChange }: SlidersProps<Key>) {
  return (
    <>
      {sliders.map((slider) => (
        <div key={slider.key}>
          <label className="debug-map__label" htmlFor={`${idPrefix}-${slider.key}`}>
            {slider.label}
          </label>
          <input
            id={`${idPrefix}-${slider.key}`}
            className="debug__slider"
            type="range"
            min={slider.min}
            max={slider.max}
            step={slider.step}
            value={values[slider.key]}
            onChange={(event) =>
              onChange({ [slider.key]: Number(event.target.value) } as Partial<Record<Key, number>>)
            }
          />
          <p className="debug-map__note">{slider.say(values[slider.key])}</p>
        </div>
      ))}
    </>
  );
}
