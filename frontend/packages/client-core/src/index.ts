/**
 * The game client, with no interface attached: state, the protocol codec, the connection, cell maths and
 * resource interpolation. Nothing in here may touch the DOM, a framework, the map or the renderer, and the
 * compiler enforces that by typechecking this package without DOM definitions.
 *
 * Everything from the outside world arrives as an injected dependency.
 */

export { PLAYER_TOKEN_KEY, ensurePlayerToken } from './identity';
export type { TokenStore } from './identity';

export { connect } from './connection';
export type { Connection, ConnectionOptions, ConnectionState, SocketLike } from './connection';
