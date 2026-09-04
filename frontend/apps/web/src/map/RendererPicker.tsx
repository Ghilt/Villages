import { RENDERERS } from './renderers';

interface RendererPickerProps {
  value: string;
  onChange: (name: string) => void;
}

/**
 * Which renderer draws the world. It sits over the map because it is a thing about the map, and it is
 * scaffolding for deciding a look rather than part of the interface a player will end up with.
 */
export function RendererPicker({ value, onChange }: RendererPickerProps) {
  const chosen = RENDERERS.find((renderer) => renderer.name === value);

  return (
    <div className="renderer">
      <label className="renderer__label" htmlFor="renderer">
        Renderer
      </label>
      <select
        id="renderer"
        className="renderer__select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {RENDERERS.map((renderer) => (
          <option key={renderer.name} value={renderer.name}>
            {renderer.title}
          </option>
        ))}
      </select>
      {chosen !== undefined && <p className="renderer__note">{chosen.note}</p>}
    </div>
  );
}
