import './slice.css';

import type { CSSProperties, ReactNode, Ref } from 'react';

import { MarkButton } from '../button/Button';
import type { Showing } from '../button/Button';
import { Container } from '../container/Container';
import { Mark } from '../mark/Mark';
import type { MarkName } from '../mark/Mark';
import { NEED_WORDS, pipSaid, pipTitle, STATE_WORDS } from './sliceWords';
import type { Borne, Need, SliceState } from './sliceWords';

/** An aspect as a slice shows it: its mark, its name, and the colour its disc is drawn in. */
export interface AspectShown {
  readonly mark: MarkName;
  readonly name: string;
  /** Any CSS colour; the library's own are `var(--ui-aspect-<name>)`. */
  readonly colour: string;
}

/** The pips of what a slice or a summon bears: a buff on gilt, a debuff on velvet, its whole name its tooltip. */
export function Pips({ borne }: { borne: readonly Borne[] }) {
  if (borne.length === 0) {
    return null;
  }
  return (
    <span className="ui-pips">
      {borne.map((one) => (
        <span key={one.name} className={`ui-pip ui-pip--${one.kind}`} title={pipTitle(one)}>
          {pipSaid(one)}
        </span>
      ))}
    </span>
  );
}

/** The disc an aspect is known by: its mark in cream on its colour. */
export function AspectDisc({ aspect, size = 30 }: { aspect: AspectShown; size?: number }) {
  return (
    <span
      className="ui-aspect-disc"
      style={{ background: aspect.colour, width: size, height: size } as CSSProperties}
      title={aspect.name}
    >
      <Mark name={aspect.mark} size={Math.round(size * 0.7)} />
    </span>
  );
}

/**
 * A slice's chip, one in its house's tray: its aspect's disc and name, and whether it can work in the happening
 * going on - lit gold while its aspect **matches** and it is Empowered, ringed in its aspect's colour while it
 * **answers its anti-aspect**, plain while something it carries **works** in any happening, and dim while it is
 * **idle** - with the pips of what it bears. Pressed, it opens the slice above the tray; `chosen` says it is the one
 * open. A `jolt` from a happening arriving flashes over it in the jolt's colour, a moment after the light leaves the
 * receptacle so the two are seen as one. Drawn rather than painted. See docs/UI-COMPONENTS.md and decision record 0116.
 */
export function SliceChip({
  aspect,
  state,
  said,
  borne = [],
  chosen = false,
  jolt,
  onPress,
  disabled = false,
  showing,
  ref,
}: {
  aspect: AspectShown;
  state: SliceState;
  /** What it says under its name, when not its state's own words: `matches, ×1.5`. */
  said?: string;
  borne?: readonly Borne[];
  chosen?: boolean;
  /**
   * A jolt arriving from a happening: it flashes in the jolt's colour, once each time the key changes, `delay`
   * milliseconds after it comes - when whatever brings it reaches the chip.
   */
  jolt?: { readonly key: string | number; readonly colour: string; readonly delay?: number };
  onPress?: () => void;
  disabled?: boolean;
  /** Draw it as if hovered, pressed or focused: for the page, never for the game. */
  showing?: Showing;
  /** The chip's button, for whoever has to know where on the screen it is: what strikes it. */
  ref?: Ref<HTMLButtonElement>;
}) {
  const classes = [
    'ui-slice-chip',
    `ui-slice-chip--${state}`,
    chosen ? 'ui-slice-chip--chosen' : '',
    showing === undefined ? '' : `ui-slice-chip--showing-${showing}`,
  ]
    .filter((one) => one !== '')
    .join(' ');
  return (
    <button
      ref={ref}
      type="button"
      className={`${classes} ui-on-night`}
      style={{ '--ui-slice-aspect': aspect.colour } as CSSProperties}
      onClick={onPress}
      disabled={disabled}
      aria-expanded={chosen}
    >
      <AspectDisc aspect={aspect} />
      <span className="ui-slice-chip__words">
        <span className="ui-slice-chip__name">{aspect.name}</span>
        <span className="ui-slice-chip__state">{said ?? STATE_WORDS[state]}</span>
      </span>
      <Pips borne={borne} />
      {jolt !== undefined && (
        <span
          key={jolt.key}
          className="ui-slice-chip__jolt"
          style={
            {
              '--ui-slice-jolt': jolt.colour,
              animationDelay: `${jolt.delay ?? 0}ms`,
            } as CSSProperties
          }
          aria-hidden="true"
        />
      )}
    </button>
  );
}

/**
 * A house's slices: its name and its colour on the head, which folds the chips away and back, and the chips in a row
 * along the bottom of a wide stage or a column up the side of a deep one. A slice opened stands above the head.
 * `align` is the edge it keeps to, the house's own. See docs/UI-COMPONENTS.md.
 */
export function SliceTray({
  house,
  colour,
  open,
  onToggle,
  direction = 'row',
  align = 'start',
  opened,
  showing,
  children,
}: {
  house: string;
  /** The house's colour, on the pennant beside its name. */
  colour: string;
  open: boolean;
  onToggle: () => void;
  direction?: 'row' | 'column';
  align?: 'start' | 'end';
  /** The slice opened, which stands above the head while the tray is open. */
  opened?: ReactNode;
  /** Draw its head as if hovered, pressed or focused: for the page, never for the game. */
  showing?: Showing;
  children: ReactNode;
}) {
  return (
    <div className={`ui-slice-tray ui-slice-tray--${align}`} data-open={open}>
      {open && opened}
      <button
        type="button"
        className={`ui-slice-tray__head ui-on-night${showing === undefined ? '' : ` ui-slice-tray__head--showing-${showing}`}`}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="ui-slice-tray__fold">
          <Mark name="fold" size={16} />
        </span>
        <span className="ui-slice-tray__pennant" style={{ background: colour }} aria-hidden="true" />
        <span className="ui-slice-tray__house">{house}</span>
      </button>
      {open && <div className={`ui-slice-tray__chips ui-slice-tray__chips--${direction}`}>{children}</div>}
    </div>
  );
}

/** One of an opened slice's effects: its name, what it needs, whether it works now and what it does. */
export interface EffectShown {
  readonly name: string;
  readonly need: Need;
  readonly works: boolean;
  /** What it is doing now, or waiting for: `working, ×1.5`, `waits for Holy`. */
  readonly now: string;
  readonly words: string;
}

/**
 * A slice opened: its aspect, its house, its state; its two effects, each with what it needs of the happening -
 * a matching aspect, its anti-aspect, or any - and whether it works now; what is in its slot; and its numbers. A
 * container, `card.slice`, closed by its mark. See docs/UI-COMPONENTS.md.
 */
export function SliceOpened({
  aspect,
  house,
  state,
  said,
  effects,
  slot,
  numbers,
  borne = [],
  onClose,
  width = 380,
}: {
  aspect: AspectShown;
  house: string;
  state: SliceState;
  said?: string;
  effects: readonly EffectShown[];
  /** What stands in its slot, said whole: `Master Oswin, reason 16`. */
  slot?: string;
  /** Its numbers, each a word and a value: power, integrity, summons. */
  numbers: readonly (readonly [string, string | number])[];
  borne?: readonly Borne[];
  onClose: () => void;
  width?: number | string;
}) {
  return (
    <Container recipe="card.slice" className="ui-slice-opened" style={{ width }}>
      <div className="ui-slice-opened__head">
        <AspectDisc aspect={aspect} size={36} />
        <div className="ui-slice-opened__title">
          <span className="ui-heading">
            {aspect.name}, {house}
          </span>
          <span className="ui-label">{said ?? STATE_WORDS[state]}</span>
        </div>
        <Pips borne={borne} />
        <MarkButton label="Close the slice" mark="close" size="small" onClick={onClose} />
      </div>
      <ul className="ui-slice-opened__effects">
        {effects.map((effect) => (
          <li key={effect.name} className="ui-slice-opened__effect">
            <span className={`ui-slice-need ui-slice-need--${effect.need}`}>{NEED_WORDS[effect.need]}</span>
            <span className="ui-slice-opened__effect-words">
              <span className="ui-body">
                <b>{effect.name}</b>
                {' · '}
                <span className={effect.works ? 'ui-slice-opened__works' : 'ui-slice-opened__waits'}>
                  {effect.now}
                </span>
              </span>
              <span className="ui-label">{effect.words}</span>
            </span>
          </li>
        ))}
      </ul>
      {slot !== undefined && <p className="ui-label ui-slice-opened__slot">In its slot: {slot}</p>}
      <p className="ui-label ui-numeral ui-slice-opened__numbers">
        {numbers.map(([word, value]) => (
          <span key={word}>
            {word} {value}
          </span>
        ))}
      </p>
    </Container>
  );
}
