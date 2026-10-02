/**
 * The game client, with no interface attached: state, the protocol codec, the connection, cell maths,
 * resource interpolation and ages. Nothing in here may touch the DOM, a framework, the map or the
 * renderer, and the compiler enforces that by typechecking this package without DOM definitions.
 *
 * Everything from the outside world arrives as an injected dependency.
 */

export { PLAYER_TOKEN_KEY, ensurePlayerToken, forgetPlayerToken } from './identity';
export type { TokenStore } from './identity';

export { connect } from './connection';
export type { Connection, ConnectionOptions, ConnectionState, SocketLike } from './connection';

export {
  NO_HOUSES,
  cellsHeld,
  charactersInView,
  forgetCells,
  holdCells,
  housesInView,
  omittedInView,
  reduceHouses,
} from './houses';
export type { HousesState } from './houses';

export { TICK_MS, freeNow, stockNow } from './stocks';

export { ageOn } from './ages';

export { whatToFollow } from './following';
export type { Following } from './following';

export { NOTHING_IN_FLIGHT, answered, canAct, goingOut } from './commands';
export type { Going, InFlight, Lane, Outgoing } from './commands';

export { HOLD_MS, follower } from './follower';
export type { Follower, FollowerPorts, Schedule } from './follower';

export { choose, keepReading, pressNext, showing, startReading } from './reading';
export type { Press, Reading, Showing } from './reading';
