# 0050. The world carries no credits, and the game owes the player some

- Status: accepted
- Date: 2026-09-20

## Context

The map's style put a line of source credits on the `terrain` source —
*Copernicus Global Land Service · HydroSHEDS · RESOLVE Ecoregions · Natural Earth* — and MapLibre's
attribution control drew it along the bottom of the world. Three of those four are CC-BY and must be
credited; Natural Earth is public domain and needs nothing.

Adam, looking at it: *can that be removed?* And then, having looked again: *it still shows up if using the
raw renderer; it's not there on the others.*

That second sentence is the whole of it. **MapLibre credits the sources whose layers are showing.** A
painted renderer hides the flat tiles and draws its own, and its source declares no attribution — so the
line appeared on `raw` and on none of the other five. The credit was not being given four times out of
five, and nobody had noticed, because the thing that was supposed to guarantee it looked like it was
working.

## Decision

**The map draws no attribution control, and no controls at all.** The zoom buttons went in 0049 for their
own reason; this takes the last of it. The map is the world rather than a map of it, and a line of source
credits along the bottom of the world is the one piece of chrome that most says otherwise.

**The credit is owed and it is recorded in `AUTHORING-THE-WORLD.md`**, which already lists the five
sources and how each is licensed, with each one's exact line on its entry in `worldSources.ts`. That is a
reasonable manner for an unreleased pre-alpha, which is what CC-BY asks for.

**And the game owes the player one.** There is no about screen, no credits page, and nowhere a player
could read this. That is on the roadmap under **Later**, and the document says so where somebody
regenerating the world will read it.

## Consequences

**A licence term stopped being honoured by accident and started being honoured on purpose.** It was in a
control that silently did nothing on five of six renderers; it is now in a document that is read by the
person who rebuilds the world, and the debt is named rather than assumed discharged.

**A test that asserted the credit changed sides.** `mapConfig.test.ts` checked that the style carried the
attribution; it now checks that it does not, with the reason in a comment above it. A test that asserts an
absence is worth having here: putting the line back on the map would be a reasonable-looking change and
the wrong one.

The cost, taken knowingly: **the obligation is now carried by a document rather than by the program**, and
a document cannot fail a build. The roadmap item is the mitigation and it is a weak one. The strong
version is the about screen, and until it exists this is a thing that can be forgotten.

## Alternatives considered

**Fix it rather than remove it** — declare the same attribution on each painted source, so the credit
shows on all six renderers. It is a few lines and it discharges the obligation in the program. Rejected
because Adam asked twice for it to be off the world, and because he is right about what it does to the
picture: the credit is a fact about how the world was made, and the world is not a map with a footer.

**Put it in the debug panel.** It is already the place everything else about the world lives. Rejected by
0039: the panel is Adam's instrument and nothing a player will ever have, so a credit there is a credit
nobody is given.

**Build the credits page now.** It is small, and it would discharge the debt properly. Rejected as scope:
it is a player-facing surface and what belongs on it — the sources, the engine, the fonts, whoever else
by then — is a thing to decide once rather than to grow a line at a time from a licence footnote.
