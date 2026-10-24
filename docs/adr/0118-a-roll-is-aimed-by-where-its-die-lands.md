# 0118. A roll is aimed by where its die lands

- Status: accepted
- Date: 2026-10-23
- Plan: `docs/plans/choice-roll-podium.md`
- Supersedes 0084 in one part, what the page sends and the circle the server reads round it: the view's centre and
  zoom, and the looking circle. 0084's ground map, how it is read and the fog stand.

## Context

A **choice roll** (0083) reads the map's omens round where the player is looking: a circle about the centre of the
view, as wide as an ordinary window shows at the zoom (0084). Nobody can see that circle. The player cannot tell what it
took in, and a roll "aimed" at a river is a roll made while a river happened to be on the screen.

Adam, on 2026-10-22: *"When the player presses it -> they get to throw a dice on the map with physics, because thats
fun, where it lands, thats a big omen, especially if contructing a building is chosen, then that becomes a coordinate.
(they can just drop it also then lands pretty close to where they drop it (theres a shadow guiding)) the omens gets
drawn from a circle around where the dice landed."* The physics is "not an essential part, just a fun flourish". On the
first draft, which gave the die an omen and an option of its own: *"before the omens were generated for the screen
focus, now its a more narrow area around where the die landed"*, and a die in the fog is a valid roll, *"the player can
chose to want to explore india for example, then they would go there and roll there."*

Every term was put to him as a question and settled the same day, and the die was felt on a spike page,
`/admin/inspect-die`, before anything of the game changed.

## Decision

**Take action is a die on a little podium, and where the die comes to rest is the roll's landing.**

1. **The die is picked up by a long press**, which leaves an empty slot on the podium. It hangs under the pointer or the
   finger, the same on a phone as on a desktop, its shadow on the ground under it, and the map is moved before it is
   picked up. Let go still, it **drops** by its shadow; let go with a flick, it is **thrown**, flies one arc, bounces and
   rolls; let go over its empty slot, it goes back and nothing happens. Enter drops it at the view's centre.
2. **A roll is paid when its die is let go**, in the decision that records it. The page works out the whole throw
   then, so it knows where the die will rest, and sends the roll at once; the hand that answers it is held back until
   the die has rested and been seen resting. A die put back sends nothing and costs nothing. *Amended 2026-10-24*: it
   was paid when the die came to rest, until the die had to show the roll's rarity as it landed (point 6).
3. **The page sends the landing**, a latitude and a longitude, and no longer the view's centre or its zoom. It is a
   claim like every other: a place that is not on Earth is refused, `invalidLocation`, and nothing else about it is the
   page's word. It needs no reach rule, because the page can show any part of the world, and nothing is gained by lying
   about where a die fell, since dropping it there would have done the same.
4. **The map's omens are read in the landing circle**: the ground about the landing, `omens.landingCircleKm` round it,
   25 km to begin with and the same at every zoom, Adam's *"lets start wit ha static value and no change depending on
   zoom"*. It is read exactly as the looking circle was: terrain, rivers, coast, open sea, houses and towns by name, only
   ground the house has revealed, and *Unknown* when none is. The cell of the ground map the landing is in is always
   read, so a circle narrower than a cell still reads the ground under the die. A die in the fog is a valid roll.
5. **The die changes nothing else about a roll.** It has no omen and no option of its own, the odds are untouched, and
   the windows, the dialogue and the key figure the page has open stay omens.
6. **The pips are the game's, and say the roll's rarity.** The page works out the whole throw the moment the die is
   let go, so it knows which face will come up, and paints on it the number the roll drew as its answer comes back,
   while the die is still in the air: 6 legendary, 5 rare, 3 or 4 uncommon, 1 or 2 common. Adam's word of 2026-10-24.
   An answer slower than the throw paints the face where the die lies. The player alone decides where the die lands.
7. **The throw is the page's flourish and nothing more.** It is worked out by a rigid cube of our own in
   `apps/web/src/sprites/die/`, a few hundred lines, and drawn on the sprite canvas the map already has, fetched only
   after the game has started. The server neither seeds a throw nor replays one, because the physics decides nothing the
   server keeps: a player could always have dropped the die where a throw took it. A house bot rolls by sending a
   landing, with no die at all.
8. **The roll's event keeps where its die landed and how wide its circle was**, `landing` and `circleKm` on
   `villages.player.rolled.v1`, absent on every roll made before the die, so stored events read as they were written
   (0074, 0100). A retune of the circle never rewrites what a roll read. The hand that is waiting carries them too, so a
   reloaded page draws the die where it fell.
9. **The die and its ring are the info layer** (0096), drawn at every zoom over the fog and the clouds, Adam's *"info
   layer sounds good, make it a bit radiant of a flash. like the selection ring under castles"*. The ring breathes, as
   the selection ring under a castle does. Once it comes to rest, though, the die sinks in among the trees and the
   structures standing, the one over everything fading out over 0.4 s, so it can lie behind a tree or a building; its
   ring stays over everything. Adam's word of 2026-10-24, everywhere, though a die at rest goes under the fog and the grey out of sight
   with them and only its ring then shows where it lies.
10. **A die is blown off the structures and passes through the trees.** A die low over the ground a structure's
    picture covers, or touching it, is struck by a pulse from the middle of the structure's base, as a little explosion
    would, and sent gently away from it, with a small hop, while it still moves: again if it is still on one a moment
    after, six times at most. Adam's choice of 2026-10-24, of the ways put to him to keep the die off what is drawn,
    and his *"much smaller force"* of the first try. Tried first and dropped: rolling a die off a structure after it rested, *"not nice"*; boxes for the
    physics to strike, which lay behind most of the picture or let the die rest on its top; upright walls that moved the
    die out of them, which snapped it; and a cone lying on the ground that it landed on and slid off, which looked
    strange.

How the die flies and lands was found by feel at the spike, on 2026-10-22: one continuous arc, a flick near the ground
scaled up; the die growing as it rises to the top of the arc and shrinking as it falls; out where the map draws only
marks, it shrinks to almost nothing and becomes a pin in the air, and the pin lands; it strikes the ground still going,
bounces big once or twice from high up, and no bigger for a hard flick than a meek one; close in it lands as a die does,
within a few of its own widths. The numbers are `FLIGHT` and `FEEL` in `sprites/die/`, on sliders at the spike page.

## Consequences

- **A house AI aims a roll by choosing its landing.** What a landing would read and open can be worked out without
  rolling, which the fate engine gives it as `FateEngine.opens`: a bot looks for the landing that opens the pool holding
  the action it wants, and drops its die there.
- **A building action has its place.** An action that raises a structure stands it at the landing, a place the player
  chose and the server read and kept. Where a landing must be more than a claim, ground a house may build on, is that
  plan's rule, checked when the action is dealt and again when it is taken.
- **The balance's numbers for the looking circle are read against the fixed width**: a river counts in a circle of 400
  km or less, houses and towns by name in one of 150 km or less. At 25 km all three always count.
- **Zoomed out, a die covers more ground than its ring**, and aiming well means coming in. That is part of the
  experiment, and the width is one number at `/admin/inspect-balance`.
- **The wire changes once**: `roll` gains `landing` and loses `centre` and `zoom`, `yourChoice` gains `landing` and
  `circleKm`, and the protocol's version goes up (0037).
- **Other players never see a throw.** A throw's path is about a kilobyte, and could be sent later.

## Alternatives considered

- **Keep the looking circle and throw the die only to place a building.** The aim would stay invisible, and the die
  would arrive only for the few actions that build.
- **An omen of the die's own, and a first option drawn from what it lay in.** The first draft. Dropped on Adam's word:
  the die moves the circle and narrows it, and does nothing else.
- **A circle that follows the zoom, the house's progression or the strength of the throw.** One fixed number first, to
  experiment with. Growing it with progression is still a fine later lever.
- **A physics engine.** cannon-es, about 40 KB, or Rapier with three.js, about 1.3 MB, a second WebGL context and
  three's shader compiles. One die bouncing on a plane needs neither, and the cube of our own costs 1 to 3 ms a throw.
  Dice that strike each other would be where an engine first earns its keep.
- **The server seeding and replaying the throw.** It would make the resting place luck, a gamble on where the die
  ends, which is not the design: the drop exists to give control. And no candidate engine runs on the JVM.
- **The die striking the trees and the bushes too.** A throw into a wood would bounce from tree to tree and stop
  short, which may take away the aim the die exists to give, and trees still arriving as the ground is drawn would be
  missed. Only the structures strike (point 10).
- **A die that comes to rest on a structure rolling off it afterwards.** Built and tried, and Adam found it not nice:
  the die settles and then slides away of itself.
