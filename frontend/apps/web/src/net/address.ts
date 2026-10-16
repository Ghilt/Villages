/**
 * Where this tree's game server answers: the port the dev server worked out from the tree's own directory, or
 * `VITE_GATEWAY_URL` when that is set. A module of its own, so that a page which only connects - the events log,
 * the seeding of houses - does not take the whole session with it. See decision record 0031.
 */
export const GATEWAY_URL =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ??
  `ws://localhost:${(import.meta.env.VITE_GAME_PORT as string | undefined) ?? '8080'}/ws`;
