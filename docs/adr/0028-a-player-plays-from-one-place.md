# 0028. A player plays from one place, and has one house

- Status: accepted
- Date: 2026-09-05
- Amended 2026-09-19: where the reasoning below speaks of the day a session's scrubber is on, read the day
  the session is looking at. The slider went on 2026-09-15 and the chrono jump on 2026-09-19; the viewing
  day is still a session's own. The decision — one session per player, the newcomer takes over — is
  unaffected.

## Context

A player is a token in the browser's local storage, so every tab of a profile sends the same one and the
server derives the same `PlayerId`. Several sessions for one player therefore already happened, and
nothing anywhere noticed: the gateway indexed connections by cell and by whether they watched the event
feed, and by nothing else.

Two windows of one player is not a thing worth serving. It halves the player's attention, doubles what the
server carries for them, and leaves two copies of a state that can disagree. And it hid a live
inconsistency: the browser chose the house's identity and sent it, the gateway took it as given, and the
decider only knows whether *this stream* has been founded. Two windows picked two identifiers and founded
two houses for one player. An existing test founded three from one connection and passed.

The vision says a player plays one lineage. The code said otherwise.

## Decision

**A player has one house, and plays from one place.**

### One house

**The server works the house's identity out from the player** - `HouseId.of(player)`, a name-based UUID
over `villages:house:<player>` - and the browser stops sending one. Founding twice therefore writes to the
same stream, and the decider refuses the second exactly as it always could. No new invariant, no read model
to race against, and no client naming a stream that is not its own.

This is a rule about **founding**, not a claim that a house belongs to its founder for ever. The identity
stays an opaque UUID; a house later transferred, or a second house, needs nothing here changed. A test
pins a known player to a known house so the derivation cannot drift and orphan what exists.

### One place

The gateway keeps **one connection per player**. A second hello takes the player over: the newcomer becomes
the session and the one before is **stood down** - told `takenOver`, dropped from every cell it held and
from the event feed, and refused everything afterwards.

**The newest wins, rather than the newcomer being refused.** Refusing is the first instinct and it is the
worse of the two: a socket the server wrongly believes is alive - a crashed browser, a network that went
away without a close - would lock a player out of their own house until something noticed. Noticing means a
heartbeat and a timeout, which is machinery to write, tune and get wrong. Takeover needs no timers and
heals itself: a dead window simply loses the next time you open one, and the loser is usually already gone.

The subtle part is written down where it lives: `disconnected()` removes the session **only if it is still
the session**, because the loser's socket usually closes *after* the takeover and removing by player alone
would evict the window that just won.

### What is a session's, and what is a player's

| The session's, free to differ | The player's, the same wherever they are |
|---|---|
| The cells it holds | Which house is theirs |
| The day the scrubber is on | Their identity |
| Whether it watches the raw event feed | Later: the house-spirit, spirit items |

`yourHouse` carries the second kind: sent after welcome, with null when there is none so the answer is
definite, and again whenever the house appears or changes - to the player's session, wherever it happens to
be looking. It replaces `Welcome.ownHouse`, which was declared in Kotlin, in zod and in a fixture, and
filled by nothing since it was written.

## Consequences

`FoundHousePayload` lost `houseId`, so the wire is smaller and a class of mischief is gone. Founding twice
in one window is refused, which is correct and reads plainly in the panel: you have a house, here it is.

**Seeding a region changed shape.** Twenty houses down one socket is now one house and nineteen refusals,
so the panel's seed button founds them as twenty other players, each opening a short connection with a
freshly made token. That is what seeding a world means, it uses only the real path with no privileged
"found as anyone" frame, and it is the shape the NPC houses in `SETTING.md` will take: an NPC house is a
house, and the difference is only who issues its commands.

**A stopped window has to look stopped.** The first cut said so only in the debug panel and by greying a
button, and that was not enough: the map still panned, the scrubber still slid, the terrain was still
there, so a finished window looked alive. It now dims and says it, with a way back - a reload, because
whoever says hello last is the session, so the window that lost can simply take the player back.

`Outbound` stays a one-method interface. The gateway says `takenOver` and the client closes its own socket;
the gateway does not close sockets, because giving it that power would mean growing the interface every
test fake implements. A client that ignores the frame is left holding something inert, which is the
accepted cost.

The gateway's test suite had encoded the old assumption everywhere - a looker and a founder were two
connections on one token. They are now two players, which was always the honest reading of what those tests
meant.

Nothing here is durable. The session map is in one process's memory, so a second gateway node would not see
the first's sessions. That is fine while there is one node and it is exactly the sort of thing the broker
arrives to solve.

## Alternatives considered

- **Refuse the newcomer.** Adam's first instinct, and it needs a heartbeat to be safe, as above.
- **Let both windows play.** What the code did by accident. Divides state, doubles the load, and gives
  nothing back.
- **Keep the client's house id and enforce one house through a read model.** Eventually consistent, so two
  simultaneous foundings could both pass the check, and it leaves the client naming streams.
- **A `Player` aggregate owning which house is theirs.** The textbook answer, and a whole stream, decider
  and event type to hold one fact that a derived identifier holds for nothing. Worth revisiting when a
  player has more than one thing worth remembering - which `SETTING.md` says is coming, in the house-spirit.
- **A session identifier separate from the player token**, so a player could hold several deliberately.
  More protocol, for a capability we have just decided not to want.
