import { SHADER_LEVELS } from '../shaders/levels';
import type { ShaderLevel } from '../shaders/levels';

/**
 * Off, low or high: how much a shader draws, three words in a row in the bar of its part of the Shaders section,
 * the one that is on pressed. Greyed, and still pressable, while the switch over all the shaders is off, which
 * keeps every level as it was until it is on again.
 */
interface LevelSwitchProps {
  level: ShaderLevel;
  onChange: (level: ShaderLevel) => void;
  /** Whether the switch over all the shaders is off, so this level is kept but not drawn. */
  overruled: boolean;
  /** What the shader is, for the words said on hover. */
  what: string;
  /** What each level means, on hover, where it is not how much of the screen is worked out. */
  said?: Record<ShaderLevel, string>;
}

const SAID: Record<ShaderLevel, string> = {
  off: 'not drawn',
  low: 'a quarter of the pixels, at fewer frames',
  high: 'every pixel, at the full rate',
};

export function LevelSwitch({ level, onChange, overruled, what, said = SAID }: LevelSwitchProps) {
  return (
    <span
      className={overruled ? 'debug__levels debug__levels--overruled' : 'debug__levels'}
      role="group"
      aria-label={`how much of ${what} is drawn`}
    >
      {SHADER_LEVELS.map((one) => (
        <button
          key={one}
          type="button"
          className={one === level ? 'debug__level debug__level--on' : 'debug__level'}
          aria-pressed={one === level}
          onClick={() => onChange(one)}
          title={`${what}: ${said[one]}${overruled ? ', once the shaders are on again' : ''}`}
        >
          {one}
        </button>
      ))}
    </span>
  );
}
