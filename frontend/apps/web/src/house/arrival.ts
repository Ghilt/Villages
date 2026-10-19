/**
 * The house arriving, which is when the camera goes to it and its window opens.
 *
 * The one moment in the whole world so far that is worth being taken to, because the seat was chosen from a
 * parchment rather than from the map, and arriving at your own house with a window already open on it is
 * what the flight is for. What arrives is a house this page has not been shown before - founded a moment ago,
 * or standing already when the page loads - and never the same house sent again. It is sent again whenever
 * anything in it changes, a purse paid in a dialogue or a resource given, and a flight keyed on the house as
 * it was sent went home on every one of them: on a phone the house's window took the bay a conversation was
 * being read in. A dialogue arrives by the same rule, in `dialogues/opening.ts`.
 */

/**
 * How close the camera comes when the house arrives.
 *
 * Past 7.5, where everything on the map is drawn as itself rather than as its mark, so arriving at your own
 * house lands on its seat standing there, not on a pin.
 */
export const FOUNDING_ZOOM = 8.5;

/**
 * Whether a house has arrived: whether it is one this page has not been shown before. It remembers every
 * house it is shown, so the same house sent again, or sent again after a reconnect, has not arrived.
 */
export function arrived(seen: Set<string>, house: { readonly id: string } | null): boolean {
  if (house === null || seen.has(house.id)) {
    return false;
  }
  seen.add(house.id);
  return true;
}

/** Every house this page has gone to, for the life of the page. A reload is a new page. */
const shown = new Set<string>();

/** Whether the house is arriving now: the first time this page is shown it, and never again after. */
export function arriving(house: { readonly id: string } | null): boolean {
  return arrived(shown, house);
}
