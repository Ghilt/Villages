# 0110. An account is an email and a password, kept as its Argon2id hash

- Status: accepted
- Date: 2026-10-21
- Plan: `docs/plans/accounts.md`
- Builds on 0109, which signs a browser in by a cookie the server keeps, and on 0028, which gives a player one house

## Context

A player was a guest: a sign-in that one browser remembers (0109). Adam asked for players who sign in, so a house
can be played from any browser and is not lost with one browser's cookies. The way in had to be chosen, kept safely,
and made hard to guess, and what becomes of a guest's house had to be said.

## Decision

**An account is an email and a password on the player's own record**, beside the world and never in it. The email is
kept trimmed and lower-cased, and one account is kept under an email, held by a unique index at the instant of
writing, so two who ask at once cannot both have it. **A guest who makes an account is that account**: the same
player, so the house is kept, because the house's id is worked out from the player (0028).

**The password is kept as its Argon2id hash**, Spring Security's, salted and slow on purpose, so a copy of the store
gives a guesser a few tries a second. A new one is twelve letters or more with no rule about symbols, never one of
the commonest - a list kept in the module, and any run of the keyboard or the digits, or one letter over and over -
and never the email. At most 128 letters, so hashing one is no way to tire the server.

**Signing in swaps the browser's sign-in for a new one**, with a new secret, so whoever knew the old one knows nothing
now; making an account does the same. Whatever the browser played as before is left: a guest who signs in to another
account leaves the guest's house behind, which the form says first. *Remember me* is ticked unless unticked, and
makes the sign-in remembered for sixty days after its last use; unticked, it lasts until the browser closes (0109).

**A wrong password and an email nobody has are answered alike, and as slowly**: an unknown email is compared against
a hash nobody's password matches. Five wrong tries for an email, or twenty from one address, in a quarter of an hour
are refused `tooMany` until the quarter has passed, even with the right password; ten accounts asked for from one
address in an hour, likewise. Counted in memory, which is enough while there is one game server.

**Asking for an account with an email that has one mails that email**, saying so and what to do, and changes nothing
else. The answer's shape is the same either way; that the asker is not signed in to the email shows it was taken,
which the limit on asking keeps from being a way to harvest addresses.

**Signing out ends the sign-in on the server**, so a copied cookie stops working, stands its windows down (0109), and
clears the cookie.

## Consequences

- **An account's email is verified by a link mailed to it**, in `mailLinks` beside the rest and kept by its secret's
  hash as a sign-in is: it works once, for a day, the newest the only one that works, and its secret is after the `#`
  so no server's log sees it. It opens `/account/verify`, which sends the secret on only with a press, because mail
  scanners open links before people do. An unverified account plays and signs in all the same, and a password is
  reset only through a link mailed to its email.
- Somebody can make an account with an address that is not theirs until it is verified. The address's owner gets it
  back by resetting the password, which ends every other sign-in.
- The commonest-password list is short and the module's own; Adam can lengthen it without touching code.

## Alternatives considered

- **Bcrypt**, Spring Security's default. Sound, and Argon2id is the one the current advice names first; both are behind
  the same `Passwords`.
- **Rules about symbols and capitals.** They make passwords hard to remember and no harder to guess than length does.
- **Telling a wrong password from an unknown email.** Kinder to a player who mistyped, and a list of who plays.
