# 0055. A character is a history of their own, and a key figure is a tie in the house's

- Status: accepted
- Date: 2026-09-24
- Amends what `ARCHITECTURE.md`, `SETTING.md` and `BUILDING-A-MECHANIC.md` said a key figure would be: an
  aggregate of its own. The person is the aggregate; being a key figure is not.

## Context

The documents have expected key figures since the setting was first written down. A house "has a handful
of **key figures** the player acts through" (`SETTING.md`), and the architecture planned for them:
"places, structures and key figures become aggregates with a lifetime `[from, to)` in world-time". In both,
the key figure is the thing that exists.

Adam's brief for the first characters turns that round. Characters are the people in the world, and
perhaps one day its pets. They have stats and an age, both of which can change; they can die; they can have
a place in the world or none, and are drawn there when they have one. Being a key figure is something that
happens to one of them:

> make sure that the 'key figure' is a state a character can be in. Composition over inheritance. A
> character might be able to be a key figur of many player driven houses, who knows, we are in an
> experimentation part of development.

Three facts about the program shape the answer.

- **There is one kind of stream.** Every event, command, refusal, converter, type table and projection in
  the server is typed to the house. A character is the first second aggregate the program has had.
- **A decision is atomic inside one stream and nowhere else.** A rule that spans a house and a character is
  held by one of the two, or not held at all.
- **No client names a stream that is not its own** (decision 0028). A lever on a character is the first
  command that would.

And one about the brief: this is groundwork. Nothing in the game gives a house a key figure yet and nothing
kills one; the first of them come from the debug panel. The shape has to be right before anything is built
on it, and little else has to be.

## Decision

**A character is their own stream, `character:<uuid>`, and being a key figure is a tie written in the
house's history.** The character's history says what happens to the person. The house's says whom it took
in and whom it lost. Neither is a kind of the other.

**The character's record.** A character appears with a name, a sex, a species, the day they were born, four
stats and a portrait, and from then on their record says only what happens to them: a stat changed, they
were aged out of the ordinary, they moved on the map or left it, they died. They live `[appeared, died)` in
world-time. The events are the world's half, typed `villages.character.<verb>.v<n>`.

**The tie.** `villages.house.gainedKeyFigure.v1` and `villages.house.lostKeyFigure.v1`, each carrying the
character's id and nothing else; why a key figure was lost is the story it belongs to, not a field on it. A
house holds at most **nine** and never the same character twice. The character's own record never mentions
any of it: a character is a key figure of every house whose history holds a live tie to them. That is what
makes it a state rather than a kind. The character is not a sort of key figure and a key figure is not a
sort of character, and the next tie a house can have to a person - a spouse, a prisoner, a rival - is
another tie of the same shape, which changes nothing about the person.

**A key figure's power is their stats.** They "can become more powerful and lose power depending on what
happens", and what rises and falls is their four stats: Piety, Reason, Kindness and Physical, whole numbers
from 1 to 20. Nothing sits on the tie.

**Age is counted, never ticked.** A character carries the day they were born; their age is the completed
world months since, over twelve, plus any years they were aged out of the ordinary. There is no event on a
birthday, which is decision 0006's rule applied to people: the world records changes, not the clock. At a
world month per real day (0053), a character ages a year every twelve real days.

**The id is derived, never minted.** A character's id is a name-based UUID over
`villages:character:<houseId>:<commandId>`, the house and the command that brought them in. `FreshIds`' rule
holds; a resent command lands on the same stream and is refused there rather than making a twin; and the
house in the name stops a command id copied off somebody else's event from reaching into their house.

**A lever that names a character is refused unless the character is one of the sender's house's key
figures.** The server checks the house's own history, the truth, by a house command that can only be
refused: `ActThrough`. It writes nothing when the character is one of the house's own and is refused
`noSuchKeyFigure` when not. That is 0028's "no client naming a stream that is not its own", extended to a
stream its house holds a tie to. A second command of the same shape asks the house for room before *add a
key figure* rolls anybody. Both keep their rules in `decide`, where every rule of the game lives, and
neither needs a port for reading a house.

**Adding a key figure** asks for room, then the character appears, then the house takes them in, all in the
command's story, so the chronicle reads in the order it happened.

**The mourning.** A death is on the character's stream and the losses belong on the houses', so a reaction
carries it across. `Mourning` follows the feed on the pattern of the pledge release: on a death it writes
the loss into every house holding them, in the death's own story, and on a tie made to someone already dead
it does the same, so either order of arrival heals. Refusals are swallowed, so a replay writes nothing
twice. **No successor rises.** The setting says "if every key figure dies, someone rises to the task"; that
is deferred, and `MECHANICS.md` says so.

**On the map only when placed.** A character is on no map until moved onto one. `moved` carries a place and
a significance and never a cell (0026). The significance is the character's own, because how far out a
person is drawn should "depend greatly on the character"; it is 10 for now, which draws from zoom 9, one
step closer than a house. The map's read model keeps spans with `since` and `until`, closed by a move, by
leaving the map or by death, which makes a character the first thing on the map that ends.

## Consequences

What becomes easier:

- **A house enforces its own rules.** The nine and the gate are decided against the house's own stream, the
  way every rule has been, rather than against a read model a moment behind.
- **A choice can hand a house a key figure** in the same decision as the action that takes it, when a choice
  first does: the tie is on the stream the choice pattern already writes to (0034).
- **The next tie costs the character nothing**, and many houses tying one character never contend for the
  character's stream.

Four costs, knowingly.

- **The first second aggregate.** Events, commands and refusals gain a root each; the converter, the type
  table and the executor serve two kinds of stream; the catalogue gains a third *whose*. It is a refactor
  with no change in behaviour, done before any character exists, so that the character arrives into a
  program built for more than one kind of thing rather than bolted onto one built for houses.
- **Adding a key figure writes to two streams, and they are not one decision.** A race between the room
  check and the tie can leave a character nobody holds: placeless, touched by no lever, visible in the event
  page and harmless. Rare, and cheaper than the alternatives below.
- **A reaction keeps the ties honest.** Something has to carry a death from one stream to others. It is the
  second thing in the program that acts on its own, after the pledge release, and it inherits that one's
  rules: one pass over the feed, no cancellation table, harmless when replayed.
- **Age is the browser's arithmetic**, because the domain has no calendar. The first rule on the server that
  depends on age will need the calendar port, as the pledge's months already do.

And one limit: **nothing can yet show a character serving two houses.** The only source of key figures
rolls a new character for the sender's own house, so the case is proven by tests, not by anything on the
screen.

## Alternatives considered

- **A key figure as its own aggregate**, as the documents had it. It makes a role into a person: a key
  figure who stopped being one would have to end, and someone serving two houses would be two things.
  Rejected as inheritance in the shape of streams.
- **The tie in the character's history.** A death would end every tie in the same decision and need no
  reaction. But the nine is the house's rule and could only be checked against a read model a moment behind,
  so a tenth could slip in; and a choice could not grant a key figure in the same decision as it is taken.
  Rejected. It comes back if a tie ever grows rules that are the character's rather than the house's.
- **A tie with a history of its own**, one stream per appointment. The purest composition, with room for
  loyalty and oaths on the tie itself, at the cost of three streams written for one appointment and two
  rules held across them. Rejected for the groundwork; a tie that grows a life of its own would switch us.
- **Writing the tie first**, then the appearance. No character nobody holds, ever - but the chronicle would
  say *gained a key figure* before the key figure existed, and a failure between the two leaves the house
  holding someone who never appeared, a place in the nine gone for good. Rejected for the order the
  chronicle reads in.
- **A read port for the gate**, loading and folding a house on request. A new port, an adapter and three
  test fakes to do what a command that can only be refused does with none. Rejected.
