# 0113. Google and Discord sign in through Spring's OAuth2 client, and a tree through pretend ones

- Status: accepted
- Date: 2026-10-21
- Plan: `docs/plans/accounts.md`
- Builds on 0111, a browser signed in by a cookie the server keeps, and 0112, an account an email and a password

## Context

Adam wanted players to sign in through Google and Discord as well as with an email and a password. Both speak
OAuth2: the browser is sent to them and back with a code, which the server trades for a token, and the token for who
the player is there. Each sends a player back only to an address registered with it, exact to the port, and every
tree on this machine serves on a port of its own (0031), so only one address can be registered for each.

## Decision

**Spring Security's OAuth2 client does the asking**, from `/oauth2/authorization/<provider>` to
`/login/oauth2/code/<provider>`, both under the page's own address, which the dev server passes through to the game
server. Google is OpenID Connect, and its token is checked against Google's keys; Discord is OAuth2 with its user
endpoint. What comes back is the identity - Google's `sub`, Discord's `id` - its email, and whether the provider says
it verified it, and the accounts make it this browser's sign-in:

- **an identity signs in to the account it signed in to before**, one account to an identity, held by a unique index;
- **else it joins the account whose email it is, when both have verified it**;
- **else it is this guest's own player**, house and all, or a player of its own, and a verified email nobody holds is
  kept as the account's, verified;
- an email not verified on either side joins nothing.

A sign-in through either is remembered. Spring keeps the asking in a session between the two halves, named for the
tree as the sign-in's cookie is and ended a quarter of an hour on, and nothing after.

**The real Google and Discord are the main checkout's alone**, once Adam has registered an application with each for
`http://localhost:5173/login/oauth2/code/<provider>` and saved their ids and secrets in `.secrets/oauth.properties`
beside the shared `.git`, which git ignores. **Every other tree, and the main checkout until then, signs in through a
pretend Google and Discord** of the game server's own while the instruments are open: a page that asks which made-up
identity to be and whether its email is verified, then a code, a token and an identity in the real ones' shapes, so
Spring's client goes the same way round as it does with Google. `villages.oauth` says otherwise: `real`, `pretend` or
`off`. Their buttons follow Google's and Discord's own rules, their mark and their words (0068 has no say over them).

## Consequences

- Trying Google on a tree needs nothing registered; the real ones are tried at 5173 after the work reaches main.
- A pretend identity is the same each time for the same made-up email, as an account there is.
- On a server whose instruments are closed and that has no secrets, there is no signing in elsewhere, and the forms
  show no buttons for it.

## Alternatives considered

- **A fixed port for every tree's return**, one address registered for all: the return would land in whichever tree
  held that port, which is the trouble 0031 ended.
- **Registering every tree's port.** There is no end to the trees, and Google wants each registered by hand.
- **Writing the OAuth2 round by hand.** Short, and exactly the part that is easy to get subtly wrong - the state, the
  PKCE, the checking of Google's token - which Spring Security does as the standard says.
