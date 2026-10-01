# 0070. A dialogue is drawn in the page, not in Pixi

- Status: accepted
- Date: 2026-09-30
- Settles the open choice in `ARCHITECTURE.md`'s "What a dialogue asks of the server and the client", which
  asked for a record before the pane was drawn.

## Context

**Character dialogue** is a pane of its own (0067, 0069), and what Adam described is a scene at its top,
with the speakers standing in it and facing each other from the two sides; a feed of bubbles under it,
each with its speaker's portrait and name, coming from the left or the right by party; what the house gains
written into the feed; and feel as the point of it - characters entering, leaving and reacting, and fading
in rather than appearing.

Two places could draw it. **The page**, React and the DOM, which is where every other piece of interface
is, the parchment and the house card included. Or **a Pixi surface** inside the pane: PixiJS is in the app
already, but only in `sprites/`, where it draws the map's overlay - the sprites, the scenery and the fog -
behind the `SpriteRenderer` interface. Pixi is what sprite sheets, tweens and per-character animation are
for, and the mechanic exists for its feel.

## Decision

**A dialogue is drawn in the page**: the list, the conversation, the scene and the bubbles are React
components and elements, styled in the stylesheet, as every other pane is. A face is `figures/Portrait.tsx`
and what a line gave is the house card's own marks, so a person and a coin look the same in a conversation
as everywhere else.

**Movement is CSS**: transitions and transforms, and keyframes where one thing has to follow another.
Anybody who has asked for less motion gets less of it, from `prefers-reduced-motion`.

**Nothing in the pane knows Pixi**, and the map's overlay knows nothing of the pane.

## Consequences

**It is responsive for free.** A bubble is text in a box, so it wraps to whatever width the column or the
bay has, and a container query on the tile does the rest, as it does for every pane. A Pixi surface would
have had its layout driven by hand at every size of both forms.

**The reading can be keyed and tested.** Every bubble is an element keyed by its line's id, which is what
lets the reading place in `client-core` keep its place across a new frame without anything being redrawn,
and what lets a test find a line by what it says.

**Text reads as text.** It is selectable, it is read out by a screen reader, and it is set in the page's own
type, where text drawn into a canvas is none of those.

**Nothing new in the stack**, and no second WebGL context beside the map's and the overlay's.

**Its movement is what CSS can do.** Fades, slides, a portrait turning or lifting as its speaker talks: all
of it is transforms and opacity, which is most of what was described. What it cannot do is a character
drawn as a sheet of frames and moved like a sprite. If a scene ever needs that, a sheet of frames is still a
CSS background stepped through, and anything beyond it is a new decision rather than a quiet exception.

## Alternatives considered

- **A Pixi surface inside the pane.** Sprite sheets, tweens and animation per character, at the cost of
  another WebGL context, a layout that has to be driven rather than declared at every size of both forms,
  and text drawn into a canvas, which is worse to read and invisible to a screen reader.
- **The map's own overlay.** It is Pixi already and it is on the screen, but it is the map's: it lies under
  every tile, it moves with the camera, and a conversation is interface rather than a thing in the world.
- **A canvas of its own, drawn by hand.** Everything Pixi costs and none of what it gives.
