import type { ResourceName, StatName } from '@villages/protocol';

/**
 * The marks a **number** is known by: a resource on the house card, a stat on a key figure.
 *
 * One drawing a name, in one place, so that the key figure's piety and reason **are** the house's piety
 * and reason - the same cross and the same dividers, not two pictures that happen to look alike. The two
 * are to be joined (decision record 0055), and until they are, a player who has learnt the house card's
 * marks has already learnt half of a key figure's.
 *
 * A mark is learnt once and then costs nothing; a word costs nothing to learn and then has to keep
 * fitting. So each is a different silhouette before it is a different picture: rings inside each other, a
 * jagged ridge, two rings side by side, an A of straight legs, a cross, a heart, a bent arm and an
 * hourglass. Stroked, never filled, at the weight every other mark in the interface is drawn at.
 *
 * The marks a **pane** is known by are another family and live in `stage/Icons.tsx`.
 */

export type MarkName = ResourceName | StatName | 'age';

const MARKS: Record<MarkName, readonly string[]> = {
  /** Wealth: a coin, with a boss struck in the middle of it so it has some weight against the rings. */
  wealth: ['M12 5 A7 7 0 1 1 11.99 5', 'M12 10 A2 2 0 1 1 11.99 10'],
  /** Domain: the ridge of land a house holds, and the ground it stands on. */
  naturalDomain: ['M3 16 L8 8 L12.5 13.5 L16 9.5 L21 16', 'M3 19.5 H21'],
  /** Influence: two rings that overlap, which is what reach over people amounts to. */
  influence: ['M9.5 7 A5 5 0 1 1 9.49 7', 'M14.5 7 A5 5 0 1 1 14.49 7'],
  /**
   * Reason: a pair of dividers standing over the arc they have scribed - the instrument the age argues
   * with. Drawn with a hinge and no crossbar on purpose: legs joined by a bar read as a capital A, and a
   * mark that reads as a letter is a word pretending to be a mark.
   */
  reason: [
    'M12 7 L7 18.5',
    'M12 7 L17 18.5',
    'M6.6 19.6 Q12 22.4 17.4 19.6',
    'M12 4.2 A1.6 1.6 0 1 1 11.99 4.2',
  ],
  /** Piety: a cross, which is what observance looks like from the street. */
  piety: ['M12 4 V20', 'M7.5 9.5 H16.5'],
  /** Kindness: a heart. Adam's placeholder, until the marks are drawn properly. */
  kindness: [
    'M12 19.4 C7.2 16 4 13 4 9.6 C4 7.2 5.8 5.4 8.1 5.4 C9.8 5.4 11.2 6.4 12 7.8 C12.8 6.4 14.2 5.4 15.9 5.4 C18.2 5.4 20 7.2 20 9.6 C20 13 16.8 16 12 19.4 Z',
  ],
  /** Physical: an arm bent at the elbow, the fist up. Adam's placeholder, until the marks are drawn properly. */
  physical: [
    'M3.5 19 H14.2 C16.9 19 18.6 17.2 18.2 14.6 L17.3 8',
    'M13.3 8.2 L13.8 12.6 C11.8 11.4 8.6 11.5 6.6 13.3 L3.5 13.8',
    'M15.4 3.4 A2.4 2.4 0 1 1 15.39 3.4',
  ],
  /** Age: an hourglass, the sand run mostly through. A placeholder like the other two. */
  age: [
    'M6.5 3.5 H17.5',
    'M6.5 20.5 H17.5',
    'M8 3.5 C8 8.4 11.6 10.2 11.6 12 C11.6 13.8 8 15.6 8 20.5',
    'M16 3.5 C16 8.4 12.4 10.2 12.4 12 C12.4 13.8 16 15.6 16 20.5',
    'M9.6 20.2 C10 18.4 11 17.4 12 17.4 C13 17.4 14 18.4 14.4 20.2',
  ],
};

interface MarkProps {
  name: MarkName;
  /** Where it is drawn: its size and colour are the caller's, the drawing is this module's. */
  className: string;
}

export function Mark({ name, className }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      {MARKS[name].map((d) => (
        <path d={d} key={d} />
      ))}
    </svg>
  );
}
