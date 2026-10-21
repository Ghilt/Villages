# Accounts

**What belongs here:** how a player comes to be signed in - the guest a newcomer starts as, the account that keeps
their house, the sign-in a browser holds and how long it lasts, the mail that verifies an email and resets a
password, Google and Discord, the settings menu and its mark, the debug panel's Accounts section, the rules that must
hold, and the order it all gets built in. **What does not:** why it is shaped this way, which becomes a decision
record as each part is built; the words, which are `GLOSSARY.md`; what each part does in the running program, which
is `RUNNING.md` as each one lands; where the game is hosted, which is a plan of its own.

Planned on 2026-10-21 from Adam's brief and his answers, recorded in the sections they settled.

---

## The problem, in one paragraph

A browser is a player because it keeps a random id in local storage, `villages.playerToken` (decision record 0008),
and the server takes that id as the `PlayerId` itself: `AnonymousTokens` parses it and hands it on. So the secret
that plays a house is written in plain text into every `house.founded` and every `player.*` event, a browser that
clears its site data loses its house, and Safari throws a site's local storage away after seven days without a
visit. The game server answers no HTTP at all beyond the socket's upgrade, has no Spring Security, and sends no
mail. Adam's brief asks for players who sign in and verify their email, a *remember me* that works properly, a way
to log out, and a small menu of settings that are not the game's. The roadmap already had *Accounts behind the
identity port*, and 0008 put the port exactly where this lands.

## What Adam settled

On 2026-10-21, beside the brief:

- **Play first.** A newcomer plays at once as a **Guest**, as today; creating an **Account** later keeps that same
  house. 0008's reason still holds: a form in front of the map loses a first-time visitor.
- **Email and password, and Google and Discord.** Passkeys and emailed sign-in links are not in this plan.
- **The settings button is a mark.**
- **The menu holds Account, Sound and motion, Language and Delete my account**, and Log out.

## Is OAuth2 the right mechanism?

**For "Sign in with Google" and "Sign in with Discord", yes**: that is OpenID Connect, which is built on OAuth2,
through Spring Security's OAuth2 client. **For keeping a player signed in to our own server, no.** Running an OAuth2
authorization server of our own and handing the page tokens is machinery for many applications sharing one login.
The advice for a browser application that talks only to its own server is the other way about: the server keeps the
sign-in, and the browser holds a cookie its scripts cannot read.

So the server uses **Spring Security** for what is easy to get wrong - hashing passwords, refusing forged requests,
the OAuth2 client, the security headers - and keeps a **small sign-in store of its own** beside it, because *remember
me* is the part that has to work properly and has to be seen in the debug panel.

## Where things live

- **Accounts are not the world's history, so there are no events.** They are plain collections in the tree's own
  MongoDB database, `players`, `signIns` and `mailLinks`, and in memory when there is no Docker, as the events are.
  An email is personal and must be deletable; the event store is never wiped once the world is persistent; and
  nothing in the world replays an account. The world keeps only the `PlayerId`, which stops being a secret.
- **A new Gradle module, `accounts`**, commit scope `accounts`: the `/auth/*` endpoints on Spring MVC, Spring
  Security, the stores and the mail. It depends on `application` and `domain`, and nothing in the game depends on it.
- **`application` keeps one port**: `SignedInPlayers`, in place of `PlayerTokens`. `AnonymousTokens` goes.
- **The socket's handshake reads the cookie**, through a handshake interceptor in `app`'s `WebSocketConfig`. The
  `Gateway` takes the player from the connection rather than from `hello`.
- **The page talks to its own address.** The dev server passes `/auth` and the OAuth2 return paths through to this
  tree's game server. The socket stays direct, since a cookie does not care about ports.
- **On the page**, `net/` asks `/auth/me` before it connects. A new folder, `account/`, holds the menu and the forms,
  in the row with `house` and `inspect` in `layers.test.ts`, and among the folders that take up `ui`.

## The sign-in, and remember me

A **Sign-in** is one browser signed in to one player.

- **The cookie** holds a random 256-bit secret, HttpOnly, SameSite=Lax, and Secure anywhere but localhost. The
  server keeps only its SHA-256 hash, so a copy of the database signs nobody in.
- **The cookie is named for the tree**, `villages-signin-<tree>`, as its database and its virtual host are (0092,
  0094). A cookie ignores ports, so every tree on localhost shares one cookie jar, and without the tree in its name a
  sign-in on one tree would sign you out of every other.
- **How long one lasts.** Each is one number, Adam's to tune:
  - **Remember me** ticked, as it is unless the player unticks it: until 60 days after it was last used. Its
    cookie's lifetime is renewed at most once a day.
  - **Unticked**: the cookie goes when the browser closes, and the server ends it after 12 hours unused anyway,
    because a browser told to continue where it left off brings such cookies back.
  - **A guest** is always remembered, for 400 days after the last visit, the most a browser keeps a cookie, because
    a guest has no way to sign back in.
- **The cookie is never swapped on every request.** Two tabs racing to swap the same cookie is the classic way
  *remember me* breaks: one tab gets the new cookie and the other is signed out. A new one is given only at sign-in
  and on a password change.

**Working properly** means each of these, and each is a test:

- it outlasts closing the browser, a restart of the game server and a deploy;
- unticked, it does not outlast closing the browser;
- two tabs never sign each other out;
- signing out ends it on the server too, so a copied cookie stops working;
- changing or resetting the password, or *sign out everywhere else*, ends every other sign-in of that player;
- a sign-in that ends while the player plays dims the window with a *Signed out* screen, not a dead map;
- an iPhone does not throw it away after seven days, as it throws away today's token.

## Guests and accounts

- **The first visit.** The page finds nobody at `/auth/me` and asks `POST /auth/guest`. The server makes a fresh
  `PlayerId` and a remembered sign-in, and play goes on as it does today.
- **Creating an account** attaches the email and password, or the Google or Discord identity, to the guest's own
  `PlayerId`. The house is kept, because `HouseId.of(player)` depends on nothing else.
- **A guest with a house who signs in to another account that already exists leaves the guest's house behind**,
  because a player has one house (0028). The form says so before it happens.
- **Signing out** shows the *Signed out* screen, with *Sign in* and *Play as a guest*. It never quietly starts a new
  house.
- **Today's browsers keep their houses.** The old `villages.playerToken` is exchanged once for a guest's sign-in with
  the same `PlayerId`, and then taken out of the browser, so every house that exists, Adam's among them, carries
  over. The exchange is refused for a player who already has a sign-in or an account.

## Mail

- **Verifying the email.** Creating an account sends a link that works once, for 24 hours; the store keeps only its
  hash. The secret is after the `#` of the address, so it never reaches a server's log, and the page it opens
  confirms with a press, because mail scanners open links before people do.
- **An unverified account plays and signs in.** Account says *not verified yet*, with *Resend*.
- **Forgot password.** The link lasts an hour, and using it verifies the email too.
- **Neither creating an account nor resetting a password says whether an email is known.** Both answer the same
  either way, and the mail sent to a known address says that it already has an account.
- **In development every mail goes to an outbox** the debug panel shows, its links pressable. Mail that arrives in
  a real inbox needs a domain of our own, which waits on hosting.

## Passwords, and those who guess them

- Hashed with Argon2id, through Spring Security.
- At least 12 characters, with no rules about symbols, and refused when it is on a list of the commonest passwords
  kept in the module.
- Sign-in attempts are limited for each email and each address, counted in memory while there is one server.
- Every `/auth` request that changes something refuses a forged request. The socket keeps its check of the origin.

## Google and Discord

- **Spring Security's OAuth2 client.** Google is OpenID Connect; Discord is OAuth2 with its user endpoint.
- **Joining them to accounts.** A Google or Discord identity has one account. One whose verified email is an
  account's verified email joins that account; otherwise it makes a new account, or becomes the guest's own account
  when a guest starts it.
- **In development.** Google and Discord send a player back only to an address registered with them, exact to the
  port, and every tree has a port of its own. So the main checkout's 5173 uses the real ones, once Adam has
  registered the two applications - his step, whose secrets go in a gitignored file beside `.git` - and every
  worktree uses **a pretend Google and Discord**, which asks which made-up identity to be and answers only while the
  instruments are open. Hand-overs use the pretend ones.
- **Their two buttons follow Google's and Discord's own rules**, their mark and their words, so whether those two
  are a mark or words is not ours to say.

## The settings menu

- **A mark**, its picture a placeholder made from the moodboard until Adam paints one. On the desktop it stands in
  the stage's top right corner; on a phone, at the far end of the bottom bar, after Recent.
- **On the desktop it opens the library's `Dialog`**, not a pane, because it is not part of the game. **On a phone
  it is a pane below**, the bar's to choose like any other, because a dialog over the whole window was the desktop's
  size there: Adam's word of 2026-10-21. The same parts in both.
- **What is in it:**
  - **Account**: who you are - a guest, an email, Google or Discord - and whether the email is verified; *Create an
    account* or *Sign in*; *Change password*; your sign-ins, with *Sign out there* and *Sign out everywhere else*;
    and *Delete my account*.
  - **Motion**: follow my device, reduce, or full, over the `prefers-reduced-motion` the code already obeys.
  - **Language**: English, alone until the words are translated, and none of them are yet.
  - **Log out**, at its foot, for an account. A guest is offered *Create an account to keep your house* there
    instead, because a guest who logs out has lost the house.
- **Sound waits for sound.** The game makes none yet, so volume and mute come with its first; the menu has nothing
  in it that does nothing.
- **The settings are kept on the server, for the player**, a guest's too, so an account's follow it to another
  device.
- **Delete my account** is held to confirm, with `HoldButton`. It removes the email, the password's hash, the Google
  and Discord links, the sign-ins, the mail links and the settings. The house stays in the world with nobody to play
  it, and what the world does with such a house is a mechanic for later; the events keep only the `PlayerId`, which
  then points at nobody.

## The debug panel

A new folding section, **Accounts**, which is an instrument and so only there while the instruments are open, since
its outbox holds live links:

- **who you are**: a guest or an account, the email and whether it is verified, the player and the house;
- **this sign-in**: whether it is remembered, and when it ends;
- **the outbox**;
- **one lever, standing in for time**: *let this sign-in run out*.

What happens is said with `note('accounts', …)`.

## The names

- **Events: none.** An account is not the world's history.
- **Words**, each in `GLOSSARY.md`: **Account**, **Guest**, **Sign-in** and **Remember me**. A sign-in is not called
  a session, because a **Session** is the gateway's connected window (0028).
- **The protocol goes up twice**: once when `hello` loses `playerToken` and gains `playAs`, which is honoured only
  while the instruments are open and is how the seeder, switching player and loading a save play as somebody else;
  and once for `signedOut`.

## The rules that must always hold

| Rule | Held by | When |
|---|---|---|
| One account to an email, whatever its letters' case | a unique index on `players` | at once |
| One account to a player | a unique index | at once |
| One account to a Google or a Discord identity | a unique index | at once |
| A player's id never changes, so their house never moves | an account keeps the `PlayerId` it was made with, and nothing writes it again | at once, by construction |
| A sign-in's secret is never stored | only its hash is written | at once |
| A sign-in signed out or run out is never taken again | it is deleted at sign-out, and its end is read on every use | at once |
| A mail link works once, and only in its time | it is taken with a find-and-delete | at once |
| A changed password ends every other sign-in | the same request, straight after the new hash is written | a moment after: the others work for milliseconds longer, and they are the same player's |
| An open window belongs to a sign-in that has not ended | the accounts module tells the gateway a sign-in ended, and the gateway stands its window down | a moment after: until the frame lands the window can send a command, and it is that player's own |
| One window to a player (0028) | the gateway's takeover, unchanged | at once |

## Steps

Every step changes `RUNNING.md` for what it makes the program do. Step 2 also changes `ARCHITECTURE.md`, `CLAUDE.md`
for the new module and its scope, and the layer rules in `arch-tests`; step 3 is measured with `perf:startup`, since
the page then asks the server something before it connects.

| # | Step | Verification requests |
|---|---|---|
| 1 | **The plan**: this document, the four words in `GLOSSARY.md`, and the roadmap's *Accounts* pointing here. (docs) | Read this document: the lifetimes, the guest rules and the four words are the ones you want. |
| 2 | **Guests are signed in by the server**: the `accounts` module on Spring MVC and Spring Security; `SignedInPlayers` in place of `PlayerTokens`; sign-ins in memory and in the tree's MongoDB, kept by their hash; `POST /auth/guest` and `GET /auth/me`; the cookie named for the tree; the layer rules; the decision record. (accounts, application) | The checks. Read the decision record: an account is not the world's history, and the browser holds a cookie it cannot read. |
| 3 | **The game plays through its sign-in**, the protocol up one: `/auth` passed through; the page finds its sign-in, or becomes a guest, before it connects; the handshake reads the cookie; `hello` loses `playerToken` and gains `playAs`; the old token exchanged once; the seeder, switching player, loading a save, the load bots and the end-to-end test on the new path. (gateway, protocol, web, client-core) | 👀 Reload: your house is still yours, and local storage no longer holds `villages.playerToken`. 👀 From the debug panel, seed twenty houses, switch player and load a save: each works as it did. 👀 With another tree open in another tab, neither signs the other out. |
| 4 | **The Accounts section, and a window that knows it was signed out**, the protocol up one: who you are, this sign-in and its end, the outbox, the lever *let this sign-in run out*; `signedOut`; the *Signed out* screen. (web, gateway, protocol, accounts) | 👀 The debug panel's Accounts: a guest, remembered, ending 400 days from now. 👀 Press *let this sign-in run out*: the window dims and says you were signed out, and no map is left broken. |
| 5 | **The library's parts for signing in**: `TextField` for an email and a password, which a browser's password manager fills and offers to save, with a mark that shows the password; a form that sends on Enter; Google's and Discord's buttons, by their own rules. (web) | 👀 `/admin/inspect-ui-components`, Fields: every state at both widths and on both grounds. 👀 The two buttons look like the ones you know from other sites. |
| 6 | **The settings mark and its menu**: the mark and where it stands; the `Dialog` with Account (who you are), Motion and Language; the settings kept for the player. (web, accounts) | 👀 The mark beside the title on the desktop and at the end of the bar on a phone: the right place, and the right picture? 👀 Motion set to *reduce*: what stops under your device's own reduce-motion setting stops, and stays stopped after a reload. |
| 7 | **Create an account, and sign in with an email and a password**: the guest's house kept; *Remember me*, ticked unless unticked; Log out; Argon2id; attempts limited; forged requests refused; the warning before a guest with a house signs in elsewhere. (accounts, web) | 👀 As a guest with a house, create an account and reload: the house is yours. Log out: the *Signed out* screen. Sign in: the house is back. 👀 *Remember me* ticked, quit Chrome altogether and open it again: still signed in. Unticked: signed out. |
| 8 | **Verify the email**: the mail sent on creating an account, into the outbox; the page its link opens, and its confirm; *Resend*; *not verified yet* in Account. (accounts, web) | 👀 The outbox in the debug panel holds the mail; open its link, and Account says verified. 👀 The mail's words. |
| 9 | **Forgot and change the password**: the reset mail and its page; *Change password* in Account; each signs out every other browser of yours. (accounts, web) | 👀 *Forgot password* on the sign-in form, then the outbox: the new password works and the old one does not. 👀 A private window signed in to the same account is signed out by it. |
| 10 | **Your sign-ins, and remember me proven**: Account lists every browser signed in, with its browser, system and last use, *Sign out there* and *Sign out everywhere else*. The end-to-end test closes and opens the browser ticked and unticked, restarts the game server, plays in two tabs and lets 61 days pass on the server's clock. (accounts, web, build) | 👀 Two browsers in the list; *Sign out there* on the other, and it dims within a second. The checks: the remember-me tests are green. |
| 11 | **Google and Discord**: Spring Security's OAuth2 client, the rules that join an identity to an account, the pretend Google and Discord for worktrees, and the real ones at 5173 once Adam has registered them. (accounts, web) | 👀 In this tree, *Sign in with Google* through the pretend one as a guest with a house: the house is kept. 👀 A made-up Google identity with your verified account's email joins that account. On main: your own Google account at 5173. |
| 12 | **Delete my account**: held to confirm; everything of the account removed; the house left with nobody to play it; the browser at the *Signed out* screen. (accounts, web) | 👀 Deleted: you are signed out, signing in with that email fails, and the house is still on the map with the fog lifted. |
| 13 | **The instruments opened to Adam alone**, if Adam wants it now: `villages.instruments=accounts`, with the verified emails that open them; everybody else is refused `instrumentsClosed`. (gateway, accounts, docs) | 👀 Signed in as you, the debug panel works; signed in as another account, every lever is refused. |

The order is a suggestion. Steps 2 to 4 are the sign-in on its own and stand without the rest; 5 to 10 are the
account; 11 and 12 can go in either order; 13 needs only 7.

## Not in this plan

- **Hosting**: mail that reaches a real inbox, a public address, HTTPS and whatever stands in front of the server.
  Nothing is deployed (0012), and that is a plan of its own.
- **Sound**, until there is some.
- **Passkeys**, which Spring Security supports: a small step once accounts stand.
- **More than one game server.** Sign-ins are in MongoDB, so any server reads them; standing a window down at
  sign-out is one process's, as the takeover is (0028).
- **What the world does with a house nobody plays**, after its account is deleted.
