# 0116. A challenge is watched in a diorama, each house holding a bank

- Status: accepted
- Date: 2026-10-21
- Plan: `docs/plans/challenge-spectacle.md`
- Builds on 0107, which resolves a challenge whole and plays it back as a spectacle, and on 0068, which builds
  whatever the player is shown from the component library

## Context

A challenge is resolved at once, and decision record 0107 left how it is played back undesigned. Ten wireframes of
screens and panels came first; Adam's word on them was that he wanted a diorama instead, in the map's perspective,
so the map's pictures can be used again. He named what it needs - the slices, folding away; a battleground where the
summons live and the tug is shown; a scene crafted for each kind of challenge, outside for a siege and inside for a
trial; a scrub to go back and forth; the history and the numbers folding away too - and asked the question that
shapes the rest: how are the two sides arranged on a tall screen, so that no figure is seen from behind and they
still face each other?

Four venues were drawn to answer it, a ford, a siege, a trial and a town square, each held both ways, and the parts
every one is built from. Adam chose the square to be built first.

## Decision

**A challenge is watched in a diorama**: a small piece of the world seen as the map sees it, from the south and above,
built from the map's own pictures, where the summons stand, act and fall and the tug is drawn on the ground. Each house's
slices, the history and the controls fold away round it. Each kind of challenge is shown in a **venue** of its own, and
the first is the square, because the game is not to be battle focused.

**Each house holds a bank.** The camera looks north and down, so a figure can be drawn turned toward us or across,
never away, and the near side of a face-off up the screen would show its back. So the two houses never face each other
up the screen: each holds a bank, left or right, both turned three-quarters toward us, as actors open to an audience.
**Held wide**, in landscape, the stage is wide; **held deep**, in portrait, the same banks are made deep, the ranks one
behind another up the screen. What lies between them runs up the screen and moves left and right either way.

**A figure faces east or west.** It is drawn once, facing south-east, and the other house's is that one mirrored, so
a summon needs one picture. A building is never mirrored: its light would move from the upper right to the upper left,
which a figure seventy pixels tall hides and a building does not.

**The tug is drawn as a share**, never as a knot on a rope: of the bar at the top, of the townsfolk in the square, of
the ground at a ford. A knot moves toward the winner and ground held moves away from them; both on one screen would move
against each other, and a share moves the same way everywhere.

**It is a view, folded on the page.** Everything shown is in what a run already carries - the moments, the summons'
kinds and the progression - and what the page already holds, its draft of the slices and the catalogue in force. The
field at a second is a pure fold of the moments up to it. Nothing is stored and the protocol does not change.

**Its parts are the library's**, each shown on `/admin/inspect-ui-components` before it is used, and every control is a
mark: play and pause, the pace, to the end, and the history.

**Venues are code until there is a second one.** Then they become a catalogue of their own, with its page, and each
challenge kind names its venue. One venue's worth of numbers does not yet pay for a reader at both ends and a page.

## Consequences

- A summon kind needs one picture, facing south-east. The figures are drawn in code until there are pictures.
- The spectacle is watched first on `/admin/inspect-challenges`, and lives in a folder of the game's own,
  `frontend/apps/web/src/spectacle/`, ready for the pane that shows it to a player when challenges reach the game.
- A venue that cannot be arranged as two banks - a duel up a staircase, a siege seen from the walls - is not drawn this
  way. That is the price of never showing a back.
- When challenges reach the game, the event of decision record 0107 carries what the replay needs; the slices it
  records stand in for the page's draft.

## Amended 2026-10-22: the happening travels through the venue, and the run is watched for the first time

Adam's word after seeing the square: the happenings stand out and are tied to the slices, and the run is watched as it
plays out, never shown as worked out beforehand. Of three ways - a figure carrying each happening, a sign drawn over
the scene, or a thing of the venue that is plainly also a sign - he chose the last.

**A happening is a seal that travels through the venue.** It forms in a patch of mist a few seconds before its
happening, drifts along a path laid in the ground to a receptacle, reaching it on the second its happening begins, and
sends a jolt along channels in the ground to each house's platform and into the chips of the slices it lights. Every
venue says where its mist, path, receptacle and channels are. A carrier could be given to one venue later on the same
path, as the seal's look and nothing else. The happening box over the stage goes.

**Nothing past the furthest second played is shown.** A run plays by itself from a moment before its first second;
the replay and the history stop at the furthest second reached, the rest under haze, and to the end shows it all.
Where a seal stands is a pure function of the second shown, as the field is, so scrubbing back shows it where it was.
