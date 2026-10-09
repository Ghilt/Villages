# 0109. A phone is the map or a window on top, and a bar of marks chooses what is below

- Status: accepted
- Date: 2026-10-08
- Supersedes the compass of 0043 and 0047; amends 0045 and 0046

## Context

On a phone the stage is two bays, a top and a bottom, or a left and a right when the phone is turned (0040).
Anything not on the screen was reached through the **compass**: a disc floating in the bottom right corner
that put **navigation** - a list of every pane, each with a needle to either bay, and the trail under it -
into the bottom bay (0043, 0047). Every pane carried the **pane size control** (0045), and any pane could go
in either bay.

Adam, on 2026-10-08: the compass *needs to go on mobile; it's too esoteric*. What he asked for instead:

- *a standard bottom bar with buttons*, and *the bottom pane should be controlled with this bar*;
- *the only thing that can open in the top view is a single inspect pane. So the top pane is either map, or
  inspect pane*;
- *the pane size control only need to be visible on the top pane*, so the map and the window wear *the same
  style of top bar*, and the map, which had none, gets one;
- and navigation, which *always navigates itself away* - a row pressed put the thing where navigation stood -
  stops doing so.

Asked, he chose: the bar's buttons are **marks only**; a place pressed in Recent opens on top and **Recent
stays open** below; a window's way back to the map is **a close mark**; turned, the bar stands **down the
right edge**; and a window keeps its frame round everything, its top bar **inside** it.

## Decision

**The top holds the map or one window, and nothing else.** Upright it is the top bay, turned the left. A
window arriving takes it, a second replaces the first, and its close puts the map back; the window stays in
the trail.

**The bottom holds every other pane, chosen by the bottom bar.** A band a thumb thick, `BAR_THICKNESS`, along
the bottom of the stage, or down its right edge turned, with a mark for each pane that can stand there - the
house, the key figures, the letter while it stands, the dialogues once there are any, and Recent - and the one
standing there lit. Pressing a mark puts its pane there, opening the bottom to half if it was put away;
pressing the lit one puts the bottom away, or opens it again. Put away, the bottom is the bar and nothing else:
the bar is its strip.

**The pane size control is the top pane's alone.** A window carries it in its **top bar**, the band a strip
thick at its head with its mark, its name and its controls; put away, a window is its top bar, turned down the
side when the phone is. **The map carries the three marks alone**, in its top right corner over a little fade:
a bar across it saying *the map* was too heavy in the picture, Adam's word on seeing it, and the map has
nothing to say that the map does not. One control is enough because it names the arrangement and the other
bay follows (0046); the bar's lit mark writes the same one value, so the two cannot disagree.

**The pane below, put away, has no control, so a press anywhere on it gives half each**, Adam's word of
2026-10-08, but on a button of its own, which does what it says - the spread's rule for a pane put away
(0045), with half rather than opened out because on a phone the stage is two things shared.

**The map's strip is no longer its own way back.** Put away, it is a strip of the map itself with the marks in
its corner, so 0046's exception - a strip of map with no control, the whole of it a button - goes: the map is
put away and brought back with the same three marks as a window.

**Navigation is Recent**, the trail, on both forms, known by a clock turned back rather than the compass. On a
phone it no longer lists the panes, because the bar does; a place pressed in it opens on top, and Recent
stays where it is.

It is built in three steps, each a commit: the top pane's top bar and the size control there alone; the top
holding the map or one window; and the bar replacing the compass. The bar and the top bar are the component
library's, `BottomBar` and `TopBar` in `ui/bar/`.

## Consequences

**A window on a phone hides the map.** It was the argument for two bays that the thing being read and the thing
it is about stay on the screen together (0040); a window on top now takes the map's place, and the map comes
back with its close. That is Adam's choice, and the bottom pane - the house, the letter, a conversation - still
stands beside whatever is on top.

**The bottom pane has no size control and draws no strip.** What is on top says how the stage is divided, and
the bar is what the bottom is put away to.

**Nothing floats over the world any more**, which the house had argued against since 0041 and the compass
alone broke (0047). The padding every pane carried to step clear of the disc goes with it.

**A pane can no longer be put in either bay.** 0043 made every pane equal in either; the top is now the map's
and the windows', and the bottom everything else's. The needles go with it.

**The desktop is untouched**, but for Recent's mark and name on the corner's tab: the spread has no bays, and
its tabs, its rail and its size controls are its own (0045, 0057).

## Alternatives considered

**Keep the compass and fix the words on it.** Rejected by Adam: it is the gesture that is esoteric, a disc that
opens a list of ways on, not its label.

**Words on the bar, or a mark with a word under it.** The usual phone bar, and nothing to learn. Adam's call
was marks, as the corner's tabs are; each still says its words to a pointer and a screen reader.

**The bar along the bottom when turned too.** One drawing rather than two, but it takes 44 of a turned phone's
390 pixels of height from both bays; down the right edge it takes width, of which there is plenty.

**A top bar on the map too**, the window's band across it with its mark and *the map*, so the top of a phone
always reads the same. Built and looked at: Adam found it far too heavy in the composition, and the map needs
only the controls.

**A window's bar above its frame**, so it is exactly the band the map then wore. Shown to Adam beside the other; he chose the
bar inside the frame, which keeps a window one framed thing.
