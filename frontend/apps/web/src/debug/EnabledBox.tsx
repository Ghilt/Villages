/**
 * The box at the top of each part of the Shaders section that turns that shader on and off for this window: a
 * way of looking, like the fog switch, so neither remembered nor sent.
 */
interface EnabledBoxProps {
  checked: boolean;
  onChange: (enabled: boolean) => void;
  /** What turning it off leaves, said on hover. */
  title: string;
}

export function EnabledBox({ checked, onChange, title }: EnabledBoxProps) {
  return (
    <label className="debug__check" title={title}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      enabled
    </label>
  );
}
