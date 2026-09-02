/**
 * The wire format between the gateway and the browser.
 *
 * The message types themselves arrive in increment 1.3, together with the fixtures in `contracts/fixtures`
 * that both this package and the Kotlin `protocol` module are tested against.
 */

/** Sent on the handshake so that the gateway can refuse a client it cannot speak to. */
export const PROTOCOL_VERSION = 1;
