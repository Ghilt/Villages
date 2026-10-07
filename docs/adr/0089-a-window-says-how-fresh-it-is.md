# 0089. A window says how fresh it is: current, or the day the fog hid it

- Status: accepted
- Date: 2026-10-07
- Builds on 0088, a window answered wherever the camera is, and 0061, the fog's three levels. Adam's words of
  2026-10-07.

## Context

A window on a thing on the map now shows it wherever the camera is: from the cells the camera holds, from what it
last said, or from the gateway's one answer. What it shows is not always as the thing is now. A house on revealed
ground - seen once, not seen now, the fog's middle level - and somebody who has walked out of the house's vision
are both known only as they were when the fog came back over them.

Adam's words: the game is built on events, so the day vision was lost is on record, and the state at that time can
be had; a window on a thing on the map should say which it is showing with a little tag, `current` or the in-game
date the last update could be received, when the fog hid it again. Quite inconspicuous, not drawing focus; beside
the name in its first row; dated like `4 Mar 1793`.

Both halves are on record. A house's sight is its vision points, each with the day it began and the day it ended,
which the page is already sent to draw the fog with. Where a person stood is spans, each with its days, which the
characters' read model keeps. Nothing renames a house or changes its blazon or seat after it is founded, so a
house's face as it was last seen is its face now.

## Decision

**A window on a house or a person carries a tag beside its name: `current`, or the day the fog hid it**, said
short, `4 Mar 1793`, with the long form, *as last seen: the fog hid it on the fourth of March, year 1793*, under the
pointer. The player's own house and people are always current; an area, which is the player's own drawing, has
none; a window that can say nothing has none.

**A house's tag is the page's to work out**, because a house never moves: whether the house's vision covers its
seat today, or else the end of the last stretch in which it did, from the vision points the page already has -
`seenUntil` in `client-core`, on the arithmetic the fog is drawn with.

**A person's is the gateway's**, because a person moves and only the gateway keeps where they stood. Answering a
window on somebody out of the house's vision, it finds the latest of their spans in which the house's vision
covered where they stood, answers them as they stood there, and says the day the fog hid them, `seenUntil` on
`inspected` - `Fog.lastSeen`, asking the same question as the page does. Somebody never in its vision is answered
with nobody, as before.

**Vision changes only on the days a point or a span begins or ends**, so those days and the ones before them are
all either asks about. **A point or a span begun and ended on one day counts on that day**: a world-day is most of
an hour, and somebody who walked through the house's vision and out again within one was seen, and hidden that
same day.

**A window out of what the camera holds asks the gateway**, once a connection, where it used to ask only when it
knew nothing, so that what it says and how fresh that is do not hang on where the camera is. What it last said
stands in until the answer comes.

**The inspect window takes the component library up** for this, the second surface to after the choice roll: the
tag is the library's `Tag`, added to it first and shown on its page. See 0073's amendment.

**Wire version 26** carries `seenUntil`.

## Consequences

**The map still shows a house on revealed ground as it is now**, because the fog lets buildings through there
(0061). It changes nothing yet, because nothing about a house's face changes; once something does, the revealed
rule should hold it at the day the fog hid it, and the window will already be saying that day.

**A person's age is today's**, worked out from their birthday, even when where they stood is from a day long gone.

**A tag answered by the gateway goes as stale as the answer does** (0088): somebody who walks back into the
house's vision while the window stays open out of the cells is still dated until the page reconnects, or they come
into a held cell.

**The two halves are written twice**, once in each language, and held to the same answers by their tests rather
than by a fixture both read. If they ever disagree, a fixture of sight histories and the days they give is the fix.

## Alternatives considered

- **The gateway saying the tag for houses too.** One place for the rule, and a frame for every change in the
  house's sight to keep a window's tag right, where the page already has the sight and redraws the fog from it.
- **A date only, no `current`.** The difference between *as it is now* and *as it was* is what the tag is for; a
  window with no tag would leave it to be guessed.
- **The day before the fog came back** - the last whole day seen - rather than the day it came back. Adam's words
  were when the fog hid it again.

## Amendment, 2026-10-07: the gateway says it, for houses too

Adam's word, the same day: it does not sound right that the page works out when a thing was last seen. The gateway
decides what a player is sent, so it is the one that knows how old it is. Two copies of one rule in two languages
had already come apart - a house of significance 80, seen from anywhere, was dated or left untagged by the page
where a person of the same was current - and only the gateway, with the events behind it, can ever send a thing as it was.

**The gateway dates what it sends, and the page shows what it is told.** `seenUntil` moves onto what it dates: a
house's view carries it wherever the house is sent from - a cell's snapshot, a change fanned out, a window's
answer - and a character's view on `inspected`. Absent, it is current. `Fog.hidOn` asks it of a house by the same
search `Fog.lastSeen` asks of a person; `seenUntil` in `client-core` is gone, and the window's tag reads the day off
the view it shows.

**A house is asked about from the points near its seat only** - within their reach and twice the tension, with room
to spare - because nothing further off can change whether its seat is covered, and that keeps it cheap enough to ask
of every house a cell sends. **Nothing more is sent for it:** a house's sight changing already answers every held
cell again, and the new days ride on that. There is no polling.

**Ground only the surface tension revealed** - between points that never saw on one day, as a key figure's path
leaves between its stops - was never in one day's vision. A house there is dated the day it was revealed, rather
than left with no tag.

**Wire version 27** carries it, and takes `seenUntil` off `inspected` itself.

This replaces *A house's tag is the page's to work out* and the consequence that the two halves are written twice;
the first alternative considered is now the decision. *A tag answered by the gateway goes as stale as the answer
does* still holds for a window out of the cells. One consequence is sharper for it: the map still sends a house on
revealed ground as it is now, so one founded there after the fog came back is sent, dated before it existed.
Holding revealed ground at the day the fog hid it - 0061's open question - is what would end that.
