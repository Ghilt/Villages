import { parseChallenges } from '@villages/world';
import type { Challenges } from '@villages/world';

import { shelved } from './shelved';

/**
 * The challenge catalogue, `world/catalogues/challenges.json`: the effects, the kinds, and the starting slices a house
 * chooses from for a challenge a quest puts to it, read once a page load and again when it changes, as the game server
 * takes it on. See decision records 0097 and 0107, amended.
 */
const challenges = shelved('challenges.json', parseChallenges);

/** The challenge catalogue, or null until it has been read, and while it cannot be. */
export const useChallenges = (): Challenges | null => challenges.use();
