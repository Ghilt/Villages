/**
 * When the loading screen lifts, as a rule that reads what is known at a moment and says what to do next.
 *
 * The game starts under the screen. Once the map has its style and the gateway has said whether the player has a
 * house, the camera is put where the player will start: on the seat, or where the page opened when there is no
 * house or a map link asked for somewhere. Then the screen waits until the map has nothing left to draw there and
 * no other work is in hand, and lifts. It never waits past `LONGEST_MS`, whatever is still coming, and never more
 * than `HOUSE_WAIT_MS` for a gateway that does not answer.
 */

/** The longest the screen stays, from the page opening: past it the game is shown however far along it is. */
export const LONGEST_MS = 12_000;

/** How long after the map is ready to wait for the gateway to say whether there is a house, before starting without. */
export const HOUSE_WAIT_MS = 3_000;

/** What the startup knows at one moment. */
export interface StartupFacts {
  /** Milliseconds since the page opened. */
  readonly now: number;
  /** When the map had its style, or null while it has not. */
  readonly mapReadyAt: number | null;
  /** Whether the gateway has said whether the player has a house. */
  readonly houseHeard: boolean;
  /** Where the camera should start, by a name for the place: the seat, or where the page opened. */
  readonly wanted: string;
  /** Where the camera was last put, by the same name, or null while it has not been. */
  readonly placed: string | null;
  /** Whether the map has had nothing left to draw since the camera was last put. */
  readonly drawn: boolean;
  /** How many works are in hand. */
  readonly inHand: number;
}

export type StartupStep =
  | { readonly step: 'wait' }
  | { readonly step: 'place' }
  | { readonly step: 'lift'; readonly cutShort: boolean };

export function nextStep(facts: StartupFacts): StartupStep {
  if (facts.now >= LONGEST_MS) {
    return { step: 'lift', cutShort: true };
  }
  if (facts.mapReadyAt === null) {
    return { step: 'wait' };
  }
  if (!facts.houseHeard && facts.now - facts.mapReadyAt < HOUSE_WAIT_MS) {
    return { step: 'wait' };
  }
  // A house heard after the camera was put where the page opened is gone to all the same, while the screen is up.
  if (facts.placed !== facts.wanted) {
    return { step: 'place' };
  }
  if (!facts.drawn || facts.inHand > 0) {
    return { step: 'wait' };
  }
  return { step: 'lift', cutShort: false };
}

/**
 * How far along the drawing is, nought to one, from the map's requests for painted tiles since the camera was put:
 * those ended out of those ended and those still open. Never less than it was, because a meter that goes back
 * says something went wrong; full once the map has nothing left to draw.
 */
export function shareDrawn(was: number, ended: number, open: number, drawn: boolean): number {
  if (drawn) {
    return 1;
  }
  const asked = ended + open;
  return Math.max(was, asked === 0 ? 0 : ended / asked);
}
