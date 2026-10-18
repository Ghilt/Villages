# 0076. The instruments are one part, and one setting closes them

- Status: accepted
- Date: 2026-10-02

## Context

Adam's instruments are the debug panel's levers and the event page: fifteen commands that stand in for what the
world will one day do - founding a house anywhere, granting and spending, pledging, every key-figure lever,
giving and taking vision, offering a dialogue - and four frames that look at the world rather than play in it:
watching every stored event, seeing everything whatever its significance, lifting the fog, and emptying the
world. Any socket could send any of them. The event page is fed every event whole, a dialogue's requirements
included, which the server otherwise holds back from every page (0071); a lifted fog shows what the fog is
there to hide; a wipe empties everybody's world. The roadmap's "Closing the instruments" said this had to be
closed before a dialogue carries the setting's secret.

They were also threaded through the connection with everything else: one `when` of seventeen branches, the
player's two commands among the levers, and the four looks among the frames of play.

## Decision

**The instruments are one part of the gateway, `Instruments`, and one setting closes all of them:
`villages.instruments`.** Open, as it is by default, they are what they always were. Closed, every lever is
refused `instrumentsClosed` and each of the four looks is answered with an error of that code, while the
player's own commands - taking an option of the choice given, and a step through a dialogue - go on as before.

**Every command goes through a registry, `Commands`**, each kind of payload with exactly one handler, put there by
the part that owns it: the levers by `Instruments`, the player's two by `Play.kt`. A second handler for a kind is
refused as it is registered, and a test holds every kind the protocol has to having one. The connection keeps
what every command shares - that a player said hello, that the id is a UUID, and the answer - and nothing about
any one command.

No hello is asked of a look, because the event page watches without one. Closing is all or nothing: there is no
list of which instruments to keep, because none of them is a player's.

## Consequences

- A server can be run with the instruments closed, `--villages.instruments=false`, and then nothing a socket sends
  reaches past what a player may do. The debug panel's levers are then each refused, which the log says.
- A new lever is a handler in `Instruments` and closes with the rest without being named *(amended 2026-10-18: a
  mechanic's levers are registered by its own part through the shared `lever`, and close with the rest the same way;
  `Instruments` keeps the four looks. See 0075)*; a new player's command is
  a handler in its mechanic's part. Neither is a branch in the connection.
- `instrumentsClosed` is a reason and an error code like any other, a word on the wire rather than a new frame, so
  the wire's shape and its version are unchanged.
- Closed is not authenticated. The day Adam wants his instruments on a server others play on, they need an
  identity of their own to open them, and this setting becomes that identity's default. That is for the
  world-persistence milestone, when the in-memory world's wipe goes or gains a guard (0036).

## Alternatives considered

- **A hello check, an instrument allowed only to a player marked as Adam.** There are no accounts to mark, and the
  event page watches without a player at all.
- **Taking the instruments out of the production build.** The server has no such build, and the same switch is
  wanted on a development server shared with somebody else.
- **One setting per instrument.** More to keep in step for no gain, since all of them are Adam's or none is.
