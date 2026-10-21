# House bots

**What belongs here:** how house bots get built - what a house bot is, where each one stands, the opening that
makes them, the command and the event, the rules that must hold, what crosses the wire, the debug panel, and the
order it all gets built in. **What does not:** why it is shaped this way, which is decision record 0108; what a
house bot is in the fiction, which is `SETTING.md`'s; the words, which are `GLOSSARY.md`. When a part of it is
decided, that part becomes a decision record and leaves.

Planned on 2026-10-21 from Adam's brief and his answers, recorded in the sections they settled.

---

## The problem, in one paragraph

A world begins empty: every house in it is one a person founded, and a player who founds a house where nobody
has played sees nobody. The factions designed on 2026-10-20 also need a house in every chair from the first day,
so that a player has somebody to rise past. Adam's brief is NPC houses that **play somewhat logically**, and
it meets a wall at once: the resources and the choice roll are not balanced, so an AI written now would be
written against numbers that will move. So the first version is the half that needs no balance: **the world
begins populated with house bots, and they do nothing.** Their AI loop comes later, on the same bots.

## What Adam settled

On 2026-10-21:

- **The first version populates the world and stops there.** Bots are made when the world begins, and they
  never act; an AI loop is given to them later.
- **A house bot is a kind of player: the one the world plays.** Its house is a house like any other, so
  `villages.house.founded.v1` stays as it is and does not say who played it. Being AI-driven is the player's
  property, not the house's.
- **The world records the bots it makes**, on its own stream, as `villages.world.botCreated.v1` with
  `{player, town}`. A person's player stays unrecorded until accounts (0028).
- **The opening** is the word for what the server does when a world begins: as it starts, after a wipe, after a
  load.
- **A bot is named after the town it stands by**, as old houses took the names of their seats.
- **A player is not told** which houses are bots. The debug panel says.

## What a house bot is

**A player the world plays, and the house that player founds.** The player is made up by the world: its id is a
name-based id over `villages:bot:<town>`, the town being the id of the town of 1790 it stands by, which never
changes when Adam repaints. From it the house's id follows as every house's does, `HouseId.of(player)`. The
house is founded by the same `FoundHouse` and the same decision as a player's, so everything that follows a
founding follows it too: the castle raised at the seat and named the seat, the sight about it and the income
it pays.

**It never connects.** Nobody is handed its token, and nothing issues a command as it, so in this version it
never acts. The debug panel's *switch* can still play one, which is how to look at the world from a bot's seat,
because a token is a player's id until accounts.

## Where each one stands

Worked out on the server, from what it holds already: the towns of 1790 in the names it reads beside the ground
map (`PlaceName`, `TOWN`, `of1790`), and the ground map itself (0084).

1. **The towns of 1790, most important first**, by the names file's rank, a town with none after every town
   with one; ties by the town's id, so the order is the same on every tree.
2. **A town too near a bot already placed is passed over**: closer than `apartKm`.
3. **The seat stands `outKm` from the town's middle**, in a direction the bot's id picks, turned a step at a time
   until it lands on land; a town with water all round at that reach is passed over. `outKm` is further than the
   greatest ruin reaches, so no seat stands in a ruin.
4. **A town whose name is not a house name** - longer than a house name may be - is passed over.
5. **Until there are `count`.**

The name is the town's name of 1790, *Nuremberg*, and its castle *Nuremberg Castle*. The banner is the server's
own banner maker's, seeded from the bot's id, so a bot keeps its banner on every tree and every start.

**The three numbers are a group of the balance**, `houseBots`: `count`, first 300; `apartKm`; `outKm`. The same
master and the same balance give the same bots everywhere. Raising `count` makes more at the next opening;
lowering it makes none and takes none away.

## The opening

**What runs when a world begins**: once the game server has started and its listeners have caught up, again
after a wipe, and again after a load. In order:

1. **The catalogues are recorded**, as they are now (0097).
2. **Each bot the world lacks is made**: `CreateBot` on the world's stream, which records `botCreated`.
3. **Each bot without a house founds one**: `FoundHouse`, as its player, at its seat.

What is there already is left alone, so opening a world twice changes nothing: a bot already made writes
nothing, as an unchanged catalogue writes nothing, and a house already founded is refused and the refusal
swallowed. **Bots are the world's, not a lever**, so they are made whether the instruments are open or not
(0076). The tests that start a game server can turn them off, because every one of them opens a world.

Each bot's writes are a story of their own, started from a name-based id over the bot and the opening, so the
events log shows a bot made and its house founded together.

## The commands and events

| | Name | Stream | Meaning |
|---|---|---|---|
| Command | `CreateBot(player, town)` | `world` | The world makes up a player to play itself, standing by a town of 1790. |
| Event | `villages.world.botCreated.v1` `{player, town}` | `world` | It did. Written once a bot; a second asking writes nothing. |

`WorldRecord` keeps the bots it made beside the catalogues, by player. **No other event is new**: a bot's house
is `villages.house.founded.v1`, its castle `villages.structure.raised.v1`, its seat `villages.house.namedSeat.v1`,
its sight and income what every house's are.

## The rules that must hold

| Rule | Held by | When |
|---|---|---|
| A bot is made once, however often the world opens | the world's stream: a second `CreateBot` for the same player writes nothing | at once |
| A bot founds one house | its house's stream: a second founding is refused | at once |
| Every bot has a house | the opening, founding every bot without one | a moment after. A bot made and the server stopped before it founds is a player with no house, which nothing reads as a house; the next opening founds it |
| A bot's seat is on land, outside its town's ruin, and apart from every other bot's | where it stands is worked out by one pure function, which the tests hold | at once, by construction |
| A bot never acts | nothing issues commands as it, and no token is handed out | by absence; *switch* plays one on purpose |

## What crosses the wire

**Nothing new for a player.** No house is told to anyone (`HousesPart`): a bot's castle arrives as a structure,
through the fog, as any house's does.

**For Adam, one field**: each row of `playersListed` says whether the player is a bot, and the protocol version
goes up at both ends.

## The debug panel

**The World section** says how many house bots the world has, and **the players list** marks them, so *switch*
can pick one. A wipe empties the world and the opening makes them again, which the events log shows.

## The steps, one commit each

| # | Step | Verification requests |
|---|---|---|
| 1 | **Documents**: this plan, decision record 0108, the glossary's Player, House bot and Opening, the line in `SETTING.md`, the roadmap | 1. Decision record 0108: is "a player the world plays, made at every opening, recorded as `botCreated`" the right shape? 2. The glossary's Player, House bot and Opening: are the words right? |
| 2 | **Where they stand**: the `houseBots` group of the balance, and the seats worked out from the towns of 1790 and the ground, pure and tested | 1. 👀 The balance page: a *house bots* group with its three numbers. 2. The checks: the same master gives the same bots, every seat on land, apart, and outside its ruin. |
| 3 | **The opening makes them**: `CreateBot` and `botCreated` on the world's stream, then each bot founds its house, at the start, after a wipe and after a load, never twice | 1. 👀 The game with *see everything*: castles with pennants beside the old towns across the world. 2. 👀 *wipe*: after the reload the castles are back. 3. 👀 A restart of the game server on a world kept in MongoDB: the events log shows no bot made twice. |
| 4 | **Telling them apart**: the players list marks bots, and the World section counts them; the protocol version up; `RUNNING.md` | 1. 👀 The World section says how many house bots there are. 2. 👀 The players list marks them, and *switch* into one shows the world from its seat. |

## Not in this plan

- **The AI loop**: a listener that plays every player the world's record lists as a bot, issuing commands as
  it. It waits on the resources and the choice roll being balanced.
- **Key figures for a bot**: founding brings none, for a player either.
- **Chairs in the factions**, held by bots first.
- **Structures standing in the world of 1790**, held by nobody.
- **Accounts**, and with them a record of a person's player.
