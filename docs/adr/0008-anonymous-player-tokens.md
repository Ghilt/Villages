# 0008. Anonymous player tokens for now

- Status: superseded by 0111, 2026-10-21: a browser is signed in by a cookie the server keeps
- Date: 2026-09-01

## Context

Nothing in the world is valuable yet, and there is no game to protect. A sign-up form is the surest way to lose a
first-time visitor before they have seen the map.

## Decision

The browser generates a token and keeps it in local storage. It is sent on the handshake and with every command.
Identity sits behind a port in the application layer, so that accounts can replace it without touching the domain.

## Consequences

A visitor can found a house seconds after arriving, with nothing to fill in. Clearing site data loses the house,
which is acceptable before the world is persistent, and has to be said plainly in the interface rather than hidden.
The gateway trusts the token, so there is no authentication and nothing valuable may depend on it until accounts
exist. Accounts are a later experiment, and the port is where they land.

## Alternatives considered

- Email and password, or magic links, now: real work before there is a game to sign up for.
- A third-party sign-in: fast for players, and an external dependency plus configuration on day one.
