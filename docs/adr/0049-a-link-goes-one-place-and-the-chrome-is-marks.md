# 0049. A link goes one place, and an inspect window's chrome is marks

- Status: accepted
- Date: 2026-09-20

## Context

0043 gave every link and every navigation row **the arrows**: a pair of needles saying which of the two
bays a thing opens into, with the bay it is already in marked rather than taken away. The argument was that
*open this* and *open this there* are one decision and so should be one control.

It did not survive contact. Commit `5995c5c` had already replaced the pair with a single needle on
navigation's rows, on the grounds that two marks where one would do turned a list of four rows into a list
of eight decisions and neither of them was the obvious one — which was pressing the row. That commit
changed no document, so four of them still describe a control the code stopped drawing.

An inspect window kept the pair. Adam, looking at it: *'show it on the map' should also be a button; in
phone mode let us just go with the map symbol and scrap the arrows for that pane* — and, asked which links
lose them, **all of them**, and asked whether the map link is words or a mark on a desktop, **the mark,
everywhere**.

Two other pieces of chrome came up in the same look. The window's **close** was the word *close* in a bar
that is otherwise three marks, and the word is what the eye goes to first — which *close* should not be.
And MapLibre's **zoom buttons** were still in the map's bottom right corner, which is where the compass
now stands (0047).

## Decision

**A link is one button and it opens in the other bay** — the bay the window it came from is not in, so the
window stays on the screen. The arrows are gone from the window as they had already gone from navigation's
rows, and **`Arrows.tsx` is deleted**: nothing draws a pair of needles any more.

There is one sensible place for a thing to open, and a player who wants it elsewhere has **navigation**,
whose whole job is saying where a pane goes. The decision the arrows offered was real but it is not a
decision worth taking twice per link.

**Show it on the map is its mark rather than its words, in both forms.** It is the only link that does not
open a window on a subject, and the map is the one thing on the stage a player already has a mark for — it
is on the map's tab, in navigation's list and in navigation's strip. A row tall rather than a glyph tall,
which is what 0043 concluded about hit targets in a list before the control it concluded it about was
taken away.

**The window's close is a mark**, drawn as every other icon button on the stage is: two crossed strokes at
the weight the rest of the mark set uses, shorter than the box they are in so it reads as a shut and not
as a deletion.

**The map's zoom buttons are gone.** They sat in the corner the compass now stands in, and the map is
driven by drag, wheel and pinch; the zoom floor still moves with the window, because those three read it.

**A button is a mark or it is words, and which one is Adam's call.** Recorded in `CLAUDE.md` rather than
here, because it is a rule about how the work is done rather than about the interface — but it is this
change that produced it.

## Consequences

**Four documents stop describing a control that does not exist.** `GLOSSARY.md`'s **Arrows** row goes
entirely and **Link** and **Needle** lose their references to it; `LOOK-AND-FEEL.md` loses its *The
arrows* entry; `MECHANICS.md` and `RESPONSIVE-DESIGN.md` lose three mentions between them. That backlog
was opened by `5995c5c` and is closed here.

**The needle survives and is still one drawing turned.** Navigation's rows use it, and the compass is
still it inside a ring — which was always the point of drawing it once.

**A player can no longer say which bay a link opens in.** That is the cost, taken knowingly. It is
recoverable in one gesture through navigation, and the arrangement the link makes is now predictable
rather than chosen: the thing you followed from is still there.

**`.inspect__what` is gone**, because a link's words are the button's own now rather than a label beside a
control.

## Alternatives considered

**Keep the arrows on subject links and take them off the map link only.** It is what Adam's first sentence
described, and I asked because the answer changes the work. Rejected by him: all of them. It is the better
answer — a rule that applies to one row of a list and not the others is a rule the player has to notice.

**Make the map link words on a desktop and a mark on a phone**, since there is room for words on a desktop.
Rejected by Adam: the mark everywhere. One drawing, learnt once, and the window reads the same in both
forms — which is the rule the whole responsive design is built on.

**Leave the zoom buttons and move the compass.** The compass has just been put in that corner on purpose,
and a map driven by a finger does not need two buttons to do what a pinch does.
