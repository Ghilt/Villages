# 0109. A browser is signed in by a cookie the server keeps, and an account is not the world's

- Status: accepted
- Date: 2026-10-21
- Plan: `docs/plans/accounts.md`
- Replaces 0008's anonymous token as the way a browser is a player; builds on 0028, which keeps a player to one
  window, and on 0092, which keeps a tree's world in a database of its own

## Context

A player was a random id the browser kept in local storage and sent in `hello` (0008), and the server took that id
as the `PlayerId` itself. So the secret that plays a house was written in plain text into every `house.founded` and
every `player.*` event, any script on the page could read it, and Safari throws a site's local storage away after
seven days without a visit, house and all. Adam asked on 2026-10-21 for players who sign in and verify an email,
and for a *remember me* that works properly. Before any of that, the way a browser is a player had to change.

## Decision

**A browser is signed in by a cookie the server keeps.** A sign-in is one browser signed in to one player; the
browser's cookie carries a random 256-bit secret, and the server keeps only the secret's SHA-256, so neither a copy
of the store nor anything that reads the events can sign anybody in. The cookie is HttpOnly, so no script reads it,
and SameSite=Lax, so another site's form does not send it. A newcomer is made a **guest**: a fresh `PlayerId`, which
is never a secret again, and a sign-in that is always remembered, because a guest has no other way back.

**How long a sign-in lasts is one number for each way it is kept, after its last use**: sixty days remembered,
twelve hours not, four hundred for a guest, in `Keeping`. **Its secret is never swapped while it is used.** Two
tabs racing to swap one secret is the classic way remember me breaks, one tab given the new secret and the other
signed out; a new one is given only when a browser signs in. A use moves the end on and gives the cookie its
lifetime again, at most once a day.

**An account is not the world's history, so there are no events.** The sign-ins and the players' records are plain
collections in the tree's own database beside the events, `signIns` and `players`, and in memory beside an in-memory
world, chosen by the same `villages.store`, so a sign-in outlasts a restart exactly when the world does. An email is
personal and must be deletable, the event store is never wiped once the world is persistent, and nothing in the
world replays an account. The game knows a player only by the id the application's `SignedInPlayers` hands it. The
collection is `players` rather than `accounts`, as the plan first had it, because a guest has a record too and a
guest has no account.

**The cookie is named for the tree**, `<its database>-signin`. A cookie ignores ports, so every tree on localhost
shares one cookie jar, and one name would have each tree's sign-in sign every other's out.

**The web server's side is plain HTTP under `/auth`, behind Spring Security**, which keeps no session of its own:
who a browser is comes from its cookie, which the accounts decide. A request that changes something is refused
unless the browser says it came from one of our pages, `OnlyOurPages`, which with a SameSite cookie is the whole
defence against a forged request, and simpler to see whole than a token the page would read and send back.

**The accounts are a module of their own, `accounts`**, plain Kotlin over MongoDB's driver: every rule of who may be
whom is there, and `app` holds only the cookie and the shapes of the answers. Nothing of the game reaches it.

## Consequences

- The socket's handshake carries the cookie, so `hello` stops carrying a token and the gateway takes the player
  from the connection. That is the next step of the plan, with the protocol one version up.
- A browser that clears its cookies loses a guest's house, as it lost one by clearing local storage; a guest is told
  plainly that an account keeps it.
- Every tree's sign-ins are kept apart, and a test's game server keeps its own because it keeps its own database.
- An ended sign-in is never accepted again: one found past its end is deleted there and then. **A window belongs to
  a live sign-in**: the accounts tell the gateway of every sign-in that ends, however it ends, and the gateway stands
  its windows down with `signedOut` (protocol 63), as a takeover stands one down. Until the frame lands the window can
  still send a command, and it is that player's own, so the moment between is harmless.

## Alternatives considered

- **An OAuth2 authorization server of our own, and tokens in the page.** Built for many applications sharing one
  login; for one page talking to its own server the advice is the opposite, a cookie the server keeps. Google and
  Discord's sign-in is OAuth2, and arrives as a client of theirs.
- **Spring Session, with Spring's remember-me.** Its remember-me swaps a token on every use, which is the race
  above, and it would have brought Spring Data into a project that speaks MongoDB's own driver.
- **The accounts as events.** Deleting an email from a store that is never wiped is the whole difficulty, and
  nothing in the world needs the history of a password.
- **Spring Security's CSRF tokens.** The page would have to read a cookie named for the tree and send it back; the
  browser's own `Origin` header says the same thing without it.
