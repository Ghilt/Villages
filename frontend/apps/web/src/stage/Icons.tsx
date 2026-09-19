/**
 * The marks a pane is known by where there is no room for its name.
 *
 * A tab bar is icons only, so every pane that can share a bay needs one. They are drawn in one place rather
 * than inside the components that use them, because the same mark has to appear on a tab, in the navigation
 * list and wherever a pane is referred to later - and a mark that is redrawn is a mark that drifts.
 *
 * The compass is **the arrows' needle inside a ring**, deliberately: the arrows say which bay a thing opens
 * into and the compass opens the pane that lists them, so they should read as one family. See
 * `LOOK-AND-FEEL.md`.
 */

/** The needle the arrows are drawn from, so the compass and the arrows are the same shape. */
const NEEDLE = 'M12 3.5 L17 19 L12 15.4 L7 19 Z';

/** The house's own frame, the achievement's contour at the size of a mark. */
const SHIELD = 'M5 4 H19 V13 C19 18 12 21.5 12 21.5 C12 21.5 5 18 5 13 Z';

export type IconName = 'shield' | 'compass' | 'map' | 'window';

interface IconProps {
  name: IconName;
  /** What it is, for anyone reading the page rather than looking at it. Omitted when a label is beside it. */
  title?: string;
}

export function Icon({ name, title }: IconProps) {
  return (
    <svg className={`icon icon--${name}`} viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      {title !== undefined && <title>{title}</title>}
      {name === 'shield' && <path d={SHIELD} className="icon__line" />}
      {name === 'compass' && (
        <>
          <circle cx="12" cy="12" r="9.2" className="icon__line" />
          <path d={NEEDLE} className="icon__fill" transform="scale(0.72) translate(4.7 4.7)" />
        </>
      )}
      {name === 'map' && (
        <>
          <path d="M3 6.5 L9 4 L15 6.5 L21 4 V17.5 L15 20 L9 17.5 L3 20 Z" className="icon__line" />
          <path d="M9 4 V17.5 M15 6.5 V20" className="icon__line" />
        </>
      )}
      {name === 'window' && (
        <>
          <path d="M4 5 H20 V19 H4 Z" className="icon__line" />
          <path d="M4 9 H20" className="icon__line" />
        </>
      )}
    </svg>
  );
}
