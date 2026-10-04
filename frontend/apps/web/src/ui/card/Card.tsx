import './card.css';

import type { CSSProperties, ReactNode } from 'react';

import type { Showing } from '../button/Button';
import { Container } from '../container/Container';
import type { Recipe } from '../container/layout';
import type { RecipeName } from '../container/recipes';

/** How good a rolled thing is, in the four bands and their colours of LOOK-AND-FEEL.md. */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

const RARITY_WORDS: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
};

/**
 * A card: a container small enough to be one of many - a key figure in a grid, something that happened -
 * with a picture at its head or down its side, a name, what it is under the name, and whatever else it
 * holds. Drawn by a recipe as any container is, `card.figure` unless it says otherwise, so a card is
 * never a stylesheet of its own.
 *
 * Given `onPress`, the whole card is one button: its name is the button, stretched over all of it, so a
 * screen reader hears one short name and a pointer can press it anywhere. It lifts under the pointer, as
 * a thing that can be picked up does (LOOK-AND-FEEL.md), sinks back pressed, has a gilt ring focused and
 * a glow chosen, and greys disabled. See docs/UI-COMPONENTS.md.
 *
 * Given a `rarity`, it is a rolled thing - an option of a choice roll - and says so twice, because a colour alone
 * is not read by everybody: an edge glowing in the rarity's colour, brighter the rarer, and the rarity's name on a
 * pill of that colour at its head.
 */
export function Card({
  recipe = 'card.figure',
  picture,
  shape = 3 / 4,
  across = false,
  title,
  line,
  children,
  onPress,
  label,
  chosen = false,
  disabled = false,
  showing,
  rarity,
}: {
  recipe?: RecipeName | Recipe;
  /** What is pictured: an `<img>`, or a portrait the game draws, covering the room it is given. */
  picture?: ReactNode;
  /** The picture's width over its height: three by four for a portrait. */
  shape?: number;
  /** The picture down the left and the words beside it, rather than the picture above them. */
  across?: boolean;
  /** Its name: Count de Montreuil. */
  title?: ReactNode;
  /** What it is, under its name: Noble · Rationalist. */
  line?: ReactNode;
  /** Whatever else it holds: stats, a quotation, what happened. */
  children?: ReactNode;
  /** What pressing it does: a card given this is a button, from edge to edge. */
  onPress?: () => void;
  /** What a screen reader calls it, when its title is not the whole of its name, or it has none. */
  label?: string;
  /** The one of several that is chosen: the key figure whose details are open. */
  chosen?: boolean;
  disabled?: boolean;
  /** Draw it as if hovered, pressed or focused: for the page, never for the game. */
  showing?: Showing;
  /** How good it is, when it was rolled: edged and named in the rarity's colour. */
  rarity?: Rarity;
}) {
  const classes = [
    'ui-card',
    across ? 'ui-card--across' : '',
    onPress === undefined ? '' : 'ui-card--press',
    chosen ? 'ui-card--chosen' : '',
    disabled ? 'ui-card--disabled' : '',
    showing === undefined ? '' : `ui-card--showing-${showing}`,
    rarity === undefined ? '' : `ui-card--rarity ui-card--${rarity}`,
  ]
    .filter((one) => one !== '')
    .join(' ');
  const press =
    onPress === undefined ? null : (
      <button
        type="button"
        className="ui-card__press"
        onClick={onPress}
        disabled={disabled}
        {...(chosen ? { 'aria-current': true } : {})}
        {...(label === undefined ? {} : { 'aria-label': label })}
      >
        {title}
      </button>
    );
  return (
    <Container recipe={recipe} className={classes} style={{ '--ui-card-shape': shape } as CSSProperties}>
      {picture !== undefined && <div className="ui-card__picture">{picture}</div>}
      <div className="ui-card__words">
        {rarity !== undefined && <span className="ui-card__rarity">{RARITY_WORDS[rarity]}</span>}
        {title === undefined ? press : <h3 className="ui-heading ui-card__title">{press ?? title}</h3>}
        {line !== undefined && <p className="ui-label ui-card__line">{line}</p>}
        {children}
      </div>
    </Container>
  );
}
