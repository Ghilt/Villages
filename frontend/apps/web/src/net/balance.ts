import { parseBalance } from '@villages/world';
import type { Balance } from '@villages/world';

import { shelved } from './shelved';

/**
 * The balance, `world/catalogues/balance.json`: what a roll costs, which the page says on Take action and greys it
 * by, read once a page load and again when it changes, as the game server takes it on. See decision record 0097.
 */
const balance = shelved('balance.json', parseBalance);

/** The balance, or null until it has been read, and while it cannot be. */
export const useBalance = (): Balance | null => balance.use();
