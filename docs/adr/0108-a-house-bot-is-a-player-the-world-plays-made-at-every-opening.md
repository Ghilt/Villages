# 0108. A house bot is a player the world plays, made at every opening

- Status: accepted
- Date: 2026-10-21
- Amended 2026-10-21 by 0114: the opening also raises a settlement on every settlement site the world lacks, after the
  bots, and passes over a site nearer a bot's seat than the balance's `settlements.clearKm`

## Context

Adam's brief of 2026-10-21: NPC houses, **house bots**, that will one day play somewhat logically. The resources
and the choice roll are not balanced yet, so an AI written now would be written against numbers that will move.
The first version is therefore the half that needs no balance: the world begins populated with house bots, and
they never act. The factions of 2026-10-20 want them too, in every chair from the first day.

What the program has:

- **A house cannot exist without a player.** `HouseFounded.player` is required, and the house's id is worked
  out from it, `HouseId.of(player)` (0028), which is how founding twice is refused by the house itself.
- **A player is recorded nowhere.** A player is the token a browser makes up, behind the identity port (0008).
  A `Player` aggregate was considered and left "until a player has more than one thing worth remembering"
  (0028).
- **Something already stands up at the start.** Antarctica's structures are raised as the server starts, with
  ids worked out from their types, so a restart over a kept world raises none twice (0093).
- **The world has a stream of its own**, which decides one thing: which catalogues it took on (0097). They are
  recorded as it starts, again after a wipe, and again after a load (0101).
- **The seed in the debug panel** founds twenty houses from the browser as twenty made-up players (0028), which
  needs a page open and puts them wherever the view was.
- **The server knows the towns of 1790** and how much each matters, and has a ground map that knows land from
  water (0084, 0087).

## Decision

**A house bot is a player the world plays, and the house that player founds.** Being AI-driven is a property of
the player, not of the house: the house is founded by the same command and the same decision as a person's, and
`villages.house.founded.v1` does not say who played it. Everything that follows a founding follows a bot's, its
castle, its seat, its sight and its income.

**The world records each bot it makes, on its own stream**: `CreateBots`, one asking for every bot, writes
`villages.world.botCreated.v1` with `{player, town}` for each it lacks, and a bot it has writes nothing, as an
unchanged catalogue writes nothing. It is the second thing the world's stream decides. The bot's player is a
name-based id over its town of 1790, which never changes when the master is repainted, so a bot is the same
player on every tree and at every start. A person's player stays unrecorded until accounts.

**The opening makes them.** *The opening* is what the server does when a world begins: as it starts, after a
wipe and after a load. It records the catalogues, makes every bot the world lacks, and has every bot without a
house found one. What is there already it leaves alone, so opening a world twice changes nothing. Bots are the
world's and not a lever, so they are made whether or not the instruments are open (0076).

**A bot stands outside the ruin of a town of 1790, and is named after it**, as old houses took the names of their
seats: towns most important first, none too near another bot's, until the balance's count. Where each stands is
worked out by one pure function from the master's names and ground and the balance, so the same world gives the
same bots everywhere. **A player is not told** which houses are bots; the debug panel is.

## Consequences

- A fresh world is populated without a browser, and the world's own history says which of its players it plays,
  which is what an AI loop will read to know whom to play.
- The world's stream gains one event a bot: a few hundred at the opening of a world.
- A bot's house is in every list a person's is: the players list shows bots, and *switch* can play one, because
  until accounts a token is a player's id. Anyone who knows a bot's id can do the same, as they can with any
  player's today.
- Every test that starts a game server opens a world, so they can turn bots off.
- Raising the count makes more bots at the next opening; lowering it takes none away, because a bot made is
  history.
- A bot made, and the server stopped before it founds, is a player with no house until the next opening.
  Nothing reads a player as a house, so the moment is harmless.

## Alternatives considered

- **A `bot` field on `villages.house.founded.v1`.** The first proposal. Rejected on Adam's word: founding should
  not know who played it, and being AI-driven belongs to the player.
- **A history for every player now**, `villages.player.created.v1` with a kind. The record 0028 deferred, written
  for every seed and every load bot, and `villages.player.*` already means *the player did this* on a house's
  stream. Accounts will shape a person's record; until then only the world's players need one.
- **No record at all**, a bot known by the shape of its id. A town dropped from the names file would leave its
  bot unknown, and nothing in the history would say the world plays it.
- **Founding them from the browser**, as the seed does. The world's own act would wait on a page being open.
- **Seats from the hand-kept gazetteer.** Fourteen places, for a few hundred houses.

## Amendment, 2026-10-21: a bot's seat keeps clear of the settlements and the roads

A bot's seat, turned an eighth at a time from the direction its town's id picks until it stands on land, is now turned
on past land within the balance's `settlements.clearKm` of a settlement's site or of a road, as `world:roads` laid them,
so a fresh world stands no castle on a village or across a road; a town with no such land at its reach has no bot. The
settlements keep the same clearance of a bot's seat at the opening (decision record 0114), so now a site is passed over
only where a bot had nowhere else to stand. A bot founded before this keeps its seat, which the world's history holds: a
world opened before it may still have a castle on a road, and before alpha a wipe is the answer. See
`docs/plans/settlements-and-roads.md`.
