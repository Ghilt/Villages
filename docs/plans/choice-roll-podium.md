# The choice roll podium: a roll aimed by where its die lands

**What belongs here:** how the choice roll's aim changes from where the player is looking to where a die they throw or
drop on the map comes to rest. That covers:

- the die, and how it is held, aimed, thrown and dropped on a desktop and on a phone;
- the landing, and the omens read under it and round it;
- what becomes of the omens read today;
- what the server takes from the page and what it checks;
- whether the physics is worth having, how it would be drawn, and what it costs;
- the names Adam is asked to agree, and the rules that must hold;
- how it meets building actions, pools that change and the house AI;
- the order of the work.

**What does not:**

- what the choice roll is for, which is `MECHANICS.md`, *Choice roll*;
- how the roll was first built, which is `docs/plans/choice-roll.md`;
- why the server reads the ground and the names, which is decision records 0084 and 0087;
- how a house AI decides what it wants, which is `docs/plans/game-ai.md` on the branch `claude/faction-ai-811bc7`.

When a term is agreed it moves to the document that owns it, and a decision record says why.

Planned on 2026-10-22, in a session of its own broken out of the work on the game's AIs, from Adam's word of that day.

---

## Adam's word

> instead of just pressing the take action. When the player presses it -> they get to throw a dice on the map with
> physics, because thats fun, where it lands, thats a big omen, especially if contructing a building is chosen, then
> that becomes a coordinate. (they can just drop it also then lands pretty close to where they drop it (theres a shadow
> guiding)) the omens gets drawn from a circle around where the dice landed. this will give the player more control and
> will feel more intuitive than jsut looking around. [...] That would not be an essential part, just a fun flourish.
> when this new way of gathering omens is established its we can add building various kinds of buildings to be added
> to the pools, once they are unlocked [...] Player progression among other things will add for example build actions
> to the players avaialable results

And, the same day, in the house AI's planning: a house AI acts mainly through the choice roll, aiming its rolls to open
the pools that hold the action it wants.

And on reading the first draft of this plan, which had the hand's first option drawn from what the landing opened:

> a die in the gof is valid, the player can chose to want to explore india for example, then they would go there and
> roll there. you can scrap 'The first option of a hand is the die's.'. just see it like this: before the omens were
> generated for the screen focus, now its a more narrow area around where the die landed

So the die moves the circle the map's omens are read in, and narrows it, and does nothing else to the roll. The die's
card went, and with it the landing omen of the first draft, an omen of its own for what the die lay in.

And, answering the questions the same day, in the words that settled them (*The terms*, below): the die stands on a
little podium and is picked up by a long press, leaving an empty slot it is put back into; it hangs under the pointer
or the finger, the same on a phone as on a desktop, and the map is moved before it is picked up; the ring is "a bit
radiant of a flash. like the selection ring under castles"; the pips are the game's to decide while the player decides
where the die lands; and the circle is "a static value and no change depending on zoom", to experiment with.

## The problem, in one paragraph

Today a roll is aimed by looking. The server reads the ground in a circle round the centre of the view, as wide as an
ordinary window shows at the zoom (0084), and nobody can see that circle. The player cannot tell what it took in, and a
roll "aimed" at a river is a roll made while a river happened to be on the screen. Adam wants the aim to be something
the player does with their hand: a die thrown onto the map, or dropped where its shadow shows. Where it lands is the
roll's own place, and the map's omens are read round it. When a hand holds an action that builds, that place is where it
is built.

## The answer, in one paragraph

**Take action is a die on a little podium, and where the die comes to rest is the roll's landing.** The player moves the
map to where they want to roll, then picks the die up with a long press, which leaves an empty slot on the podium. The
die hangs under the pointer or the finger, its shadow on the ground under it, and round the shadow lies the landing
circle, a breathing ring of light like the one under a selected castle. Held still and let go, the die drops close to
its shadow; let go with a flick, it flies, bounces and rolls; let go over its empty slot, it goes back and nothing
happens. Nothing is paid until it rests. The page sends only where it rests. **The map's omens are read as they are
today, only no longer round the centre of the view: in the landing circle, 25 km round where the die landed, whatever
the zoom**, a number to experiment with. Only revealed ground counts, and a die in the fog is a valid roll: a player who
wants to explore India goes there and rolls there. The odds are untouched, the hand is dealt as today, and the windows,
the dialogue and the key figure stay omens. **The pips are the game's**: the page works out the whole throw the instant
the die is let go, so it knows which face will come up and paints on it the number the game wants, while the player
alone decides where the die lands. The physics is a flourish and costs little: one die drawn on the sprite canvas the
map already has, moved by a few hundred lines of our own, and loaded after the game has started rather than at
startup. The server never replays the physics. It takes a point and checks it as it checks every other claim, so a
house bot drops its die by sending the same point.

## The new roll, in stages

Each stage in generic words, the first keeping the game's own, and under it what that stage is in the game. What is
new is marked **new**.

```
 TAKE ACTION ──▶ AIM ──▶ LET GO ──▶ READ ──▶ ROLL ──▶ DEAL ──▶ RECORD ──▶ REVEAL ──▶ ANSWER
```

1. **Take action**: the player asks for a roll.
   1. **new** The die stands on a little podium in the bottom middle pane, over the words *Take action* and the price,
      greyed with its reason when the house cannot pay or a hand is waiting.
   2. **new** The player moves the map to where they want to roll.
   3. **new** A long press picks the die up, and leaves an empty slot on the podium. Nothing is paid yet.
2. **Aim**: the player picks a place.
   1. **new** The die hangs under the pointer or the finger, its shadow on the ground under it. The map stays still.
   2. **new** The landing circle lies round the shadow: 25 km, the same at every zoom, a ring of light that breathes,
      like the one under a selected castle.
3. **Let go**: the place is chosen.
   1. **new** A drop: held still and let go, the die falls onto its shadow and comes to rest close by.
   2. **new** A throw: let go with a flick, the die flies, bounces, rolls and comes to rest.
   3. **new** Back: let go over its empty slot, the die goes back, and nothing happens.
   4. **new** As it is let go, the page works out the whole throw and paints the pips so that the face that will come
      up shows the game's number.
   5. **new** A house bot: no die at all. It sends the landing it chose.
4. **Read**: the server works out the omens.
   1. **new** The map's omens, read in the landing circle instead of round the view's centre. Revealed ground only,
      and a die in the fog is a valid roll, *Unknown*.
   2. The house, what changed in it, the windows, the dialogue, the key figure and the season, as today.
5. **Roll**: the rarity.
   1. Fixed odds, 70 / 22 / 7 / 1. No omen moves them, the landing included.
6. **Deal**: the hand of three, as today.
   1. Hearth, and the pools the omens open.
   2. Three drawn from every open pool, weighted.
7. **Record**: one decision.
   1. `villages.player.rolled.v1`, **new** with the landing and the circle's width.
   2. The price spent and the hand given, from the same decision.
8. **Reveal**: the report card.
   1. The omens slam in, and the options pop in under them, as today.
   2. **new** The die lies where it fell, its ring round it, while the hand is open, after a reload too.
9. **Answer**: the player takes one.
   1. The option's effect, as today.
   2. **new** The die fades from the map and stands on its podium again.
   3. *Next plan*: an action that builds raises its building where the die fell.

## What changes, and what does not

| | Today | With the die |
|---|---|---|
| What aims the map's omens | the view's centre and the zoom | the landing alone |
| The circle | as wide as an ordinary window shows at the zoom; never seen | 25 km round the landing at every zoom, to experiment with; a breathing ring, seen while aiming and after |
| The omens read in it | terrain, rivers, coast, open sea, houses and towns by name, *Unknown* | the same |
| The windows, the dialogue, the key figure | omens | the same |
| Fog | revealed ground only | the same; a die in the fog is a valid roll |
| The odds | 70 / 22 / 7 / 1, moved by nothing | the same |
| The hand | three drawn from every open pool, weighted | the same |
| Take action | a button saying *Take action* | a die on a podium over the words *Take action*, picked up by a long press |
| When it is paid | at the press | when the die comes to rest; a die put back costs nothing |
| What the page sends | centre, zoom, windows, dialogue, figure | landing, windows, dialogue, figure |
| What the roll's event keeps | the omens and the rarity | the same, and the landing and the circle's width |

## The terms, as Adam settled them

Every term was put to Adam on 2026-10-22 as a question with options and a recommendation, and every one is settled. The
numbers are kept as they were asked. Where he answered in his own words, they are quoted. "All questions good now" took
the recommendation for the rest.

### 2026-10-22 · the die: 1. What does Take action do now?

**It is a die on a little podium, and a long press picks it up.** Nothing is paid until the die comes to rest, and a die
put back costs nothing. Adam: "The die should be longpressed to be picked up, and it should be there on a little
podium."

The other options were to roll at once as today, throwing the die afterwards only to place a building, or a quick press
to roll and a held one to lift.

### 2026-10-22 · the die: 2. How is the die held and aimed?

**Under the pointer on a desktop and under the finger on a phone, the same on both, with the map moved before the die is
picked up.** Adam: "for the phone just do it like desktop, it hangs under the ginfer, flick to throw, or jsut drop, the
player should move the map before picking it up".

The other options were a crosshair over the map's middle with the map panning under it, and dragging the die out of the
Take action chip.

### 2026-10-22 · the die: 3. Putting the die back

**Into its empty slot on the podium, with no button.** Adam: "just and empty slot will communicate it nicely."

### 2026-10-22 · the die: 4. The die and its ring: the real world or the info layer?

**The info layer**, drawn at every zoom, over the fog and the clouds, never faded. The ring is a light that breathes, as
the selection ring under a castle is. Adam: "info layer sounds good, make it a bit radiant of a flash. like the selection
ring under castles".

### 2026-10-22 · the die: 5. What does the die show on its faces?

**Pips, with the number the game's to decide** (*The pips*, above). Adam: "pips, can we manipulate so that the user
decides where the die will land but we have complete control over the pips?" Yes.

### 2026-10-22 · the reading: 6. Is the view's centre still read?

**No.** Adam: "before the omens were generated for the screen focus, now its a more narrow area around where the die
landed." The landing takes the view's centre's place.

### 2026-10-22 · the reading: 7. The windows, the dialogue and the key figure?

**Omens as today.** What the player has open still colours the roll, and the die adds the place.

### 2026-10-22 · the reading: 8. What does the fog do to a die?

**A die in the fog is a valid roll.** Adam: "the player can chose to want to explore india for example, then they would
go there and roll there." Only revealed ground counts, as today: a ring with none in it is *Unknown*. Nothing is refused
and nothing is moved.

### 2026-10-22 · the reading: 9. What sets the landing circle's size?

**One number, the same at every zoom: 25 km to begin with**, `omens.landingCircleKm`. Adam: "we will experiment, lets
start wit ha static value and no change depending on zoom". The zoom leaves the roll's payload with it.

The other options were the zoom at the throw, the house's progression, and the strength of the throw. Growing it with
progression is still a fine later lever.

### 2026-10-22 · the reading: 10, 11 and 12. The landing omen and the die's card

**Dropped.** Adam: "you can scrap 'The first option of a hand is the die's.'". The first draft's landing omen, an omen
of its own for what the die lay in, went with it, because the die now only moves and narrows the circle.

### 2026-10-22 · names: 13. The names

**Approved**, Adam's "good". One name changed with question 9's answer: the balance's number for the ring was
`omens.landingCirclePx`, its radius in screen pixels, and is `omens.landingCircleKm`, its radius on the ground, because
the circle no longer follows the zoom. There is no new event type: the roll's event gains two fields, absent on every
roll made before the die, so stored events read as they were written (0074, 0100).

| Name | Where | What it means |
|---|---|---|
| `landing` | a field of `villages.player.rolled.v1` | where the die came to rest, as the server took it: a latitude and a longitude |
| `circleKm` | a field of `villages.player.rolled.v1` | how far round the landing, in kilometres, the map's omens were read |
| `landing` | a field of the `roll` command on the wire, replacing `centre` and `zoom` | where the page says the die came to rest |
| `landing`, `circleKm` | fields of the choice in `yourChoice` | where a rolled hand's die fell and how wide its ring was, so a reloaded page draws them |
| `omens.landingCircleKm` | the balance | how far round the landing the map's omens are read: 25 km |
| **Die** | the glossary | what the player throws or drops on the map to make a choice roll, picked up from its podium by a long press |
| **Landing** | the glossary | where the die came to rest: the middle of the circle the roll's map omens are read in, and where a building it deals would stand |
| **Landing circle** | the glossary, replacing **Looking circle** | the ground about the landing that the map's omens are read in, drawn as a ring round the shadow |
| **Throw**, **Drop** | the glossary, under **Die** | letting go of the die fast, so it flies and rolls, or slowly, so it falls by its shadow |

### 2026-10-22 · physics: 14. How is the throw built?

**By hand, drawn by a layer of the sprite canvas.** The other options were cannon-es, and Rapier with three.js.

Adam asked back how hard it would be, and what it would cost, for the die to strike every sprite painted on the map. It
is cheap to run and moderate to write, and the spike tries it on a switch (*Striking what is drawn on the map*, under
*The physics*).

### 2026-10-22 · physics: 15. Feel it first, on a page of its own?

**Yes, a spike page first**, `/admin/inspect-die`, which then stays as the die's inspect page.

### 2026-10-22 · building: 16. Is the first building action in this plan?

**No: its own plan**, after this one is played.

## The die

### Picked up, aimed and let go

**Take action is a die standing on a little podium**, in the bottom middle pane where the Take action button stands
today. *Take action* and what a roll costs are written under it, and the die is greyed, with the reason, when the house
cannot pay or a hand is waiting.

The roll then goes like this, the same on a desktop and on a phone, Adam's word of 2026-10-22:

1. **The player moves the map first**, to where they want to roll. The map does not move while the die is held.
2. **A long press picks the die up.** A long press, so that a tap meant for something else never lifts it. The podium
   is left with an **empty slot**, which says without a word where the die goes back.
3. **The die hangs under the pointer or the finger**, the size of a hand, the same at every zoom: it is held near the
   eye. On a phone its shadow lies a little above the fingertip and the die above that, so that the finger never covers
   the shadow.
4. **Its shadow lies on the ground under it.** That is where a drop will fall.
5. **The landing circle lies round the shadow**, a ring of light that breathes, as the selection ring under a castle
   does, and drawn by the same shader. It gives no hint of what will be read: the omens are still revealed only after
   paying, Adam's rule of the *Choice roll* entry. It shows only the ground that will count.
6. **Let go**, one gesture with no modes, told apart by how fast the die is moving as it is let go:
   - **held still, it drops**: it falls from a little height onto its shadow, bounces and comes to rest close by, Adam's
     "lands pretty close". Measured, a median of a die and a half's width from the shadow, and three at most;
   - **with a flick, it is thrown**: it starts at the flick's speed and direction, falls along an arc, bounces, tumbles
     and rolls to rest;
   - **over its empty slot, it goes back**: nothing happens and nothing is paid. A system's own gesture that cancels the
     press, such as a phone's edge swipe, puts it back too.

How far a flick carries, and how far a drop strays, are numbers found by feel on the spike page. Without a press at
all, Enter on a desktop picks the die up and drops it at the view's centre, which is exactly today's Take action. With
reduced motion asked for, a drop is short and does not tumble.

From zoom 7 out the camera looks straight down, so a die in the air sits exactly over its shadow and its height cannot be
seen. It is drawn either at an angle of its own, as the standing scenery is, or growing as it rises; the spike tries
both (*The physics*, below).

**Once it rests**, the page waits half a second so the player sees where, then sends the roll. The report card opens as
today. The die lies where it fell, with its ring, while the hand is open, after a reload too, because the choice that
comes back says where its die fell; the podium's slot stays empty meanwhile. Once the hand is answered, the die fades
from the map and stands on its podium again.

**What it costs is paid at rest.** A die put back sends nothing. A die that comes to rest sends `roll`, and the price is
spent in the same decision that records the roll (0083). If the house cannot pay by then, the roll is refused as today,
and the die goes back to its podium.

### The pips

**The player decides where the die lands, and the game decides the number it shows**, Adam's question of 2026-10-22
answered: yes, completely, and nothing visibly changes face.

- The page works out the whole throw the instant the die is let go, before it has moved: 1 to 3 ms, measured. So it
  knows which face will come up.
- It paints the pips so that face carries the number the game wants, as a real die is laid out: opposite faces add to
  seven, and any number can stand on any face, in one of a die's 24 turns.
- It then plays the throw it worked out, frame by frame, exactly as worked out. Nothing is simulated twice, so there is
  nothing to disagree.

**The one condition is that the number is known when the die is let go.** A number the page chooses, or one the server
gave it when the die was picked up, is simply painted on. A number the server could only decide from the landing would
have to arrive while the die is in the air, and be painted on a face the camera cannot see at that moment. That works
for a throw, which tumbles, and is fiddly for a drop, which barely turns.

**What the number means is not decided.** The rarity is said by the options alone (Adam's word of 2026-10-05), so the
first version paints a number the page chooses, and the spike shows the same chosen number coming up on every throw, to
prove the control.

### What the server takes, and what it checks

The page sends:

- **the landing**: where the die rests, a latitude and a longitude;
- and, as today, the inspect windows open, the dialogue being read and the key figure open.

It sends no omen and no terrain. `centre` and `zoom` leave the payload: the view is no longer read, and the circle no
longer follows the zoom.

Every field is a claim, checked as today's are:

- **The landing must be a place on Earth.** `Location` already refuses one that is not, `invalidLocation`, as it
  refuses a bad `centre` today, and nothing is paid.
- **Where the die rests needs no reach rule of its own.** The page can show any part of the world, fog or not, so any
  point on Earth is one a player could have dropped a die on.
- **Only ground the house has revealed is read**, exactly as only revealed ground counts today (0061, 0084). A die in
  the fog is a valid roll (below).
- **Nothing is gained by lying about where a die fell**, because dropping it there would have had the same result.

**The server does not seed the throw, and never replays it.** The physics decides nothing the server keeps. Where a drop
strays and how a throw bounces are the page's flourish, and a player could always have dropped the die exactly where a
throw took it. A seed would make two pages agree on a throw nobody else watches. A server replay would need the same
engine on the JVM, which does not exist for any of the candidates below. If the resting place were ever meant to be
luck, a gamble on where the die ends, the server would have to seed the throw and decide where it ends. That is not
Adam's design: the drop exists to give control.

**Where a landing will have to be more than a claim is a building.** A building raised where the die fell must stand on
ground the house may build on. That is the next plan's rule, checked by the server when the action is dealt and again
when it is taken (below).

### The landing circle

The ground about the landing on which the map's omens are read. It replaces the **looking circle** and is read exactly
as that is: terrain, rivers, coast, open sea, houses and towns by name, and *Unknown* when nothing in it is revealed.
Adam's word: "before the omens were generated for the screen focus, now its a more narrow area around where the die
landed". The die moves the circle and narrows it, and changes nothing else about the roll: no omen of its own, no
option of its own, and the odds untouched.

**Its width is one number, the same at every zoom**: `omens.landingCircleKm` in the balance, 25 km round the landing to
begin with, Adam's word of 2026-10-22, "we will experiment, lets start wit ha static value and no change depending on
zoom". It is tuned at `/admin/inspect-balance` while the server runs, and the roll's event keeps the width it was read
at, `circleKm`, so a retune never rewrites what a roll read.

On the screen the ring is drawn at its size on the ground, so it grows as the player comes in. At latitude 55, its
radius is about:

| Zoom | 10 | 9 | 8 | 7 | 6 | 5 |
|---|---|---|---|---|---|---|
| Pixels | 570 | 285 | 143 | 71 | 36 | 18 |

Zoomed out, a die covers more ground than its ring, and aiming means coming in. That is part of the experiment.

The balance's numbers that were tuned for the looking circle are read against the fixed width as they were against the
zoomed one: a river counts in a circle of 400 km or less, and houses and towns by name in one of 150 km or less. At
25 km all three always count.

**The narrow circle always reads the ground under the die.** The circle is read today at the middles of the ground
map's cells that fall inside it, and a cell is about 20 km from north to south, a sixth of a degree. A small circle can
hold few cells' middles or none, and would read as *Unknown* over ground the house has seen. So the cell the landing is
in is always read, whatever the width. The towns and the houses are read at their own places, which are exact. A river
is found by the ground's cells and only then named by its line, so a ring finds a river when the cell under the die
carries one, or a cell whose middle the ring holds.

**A die in the fog is a valid roll.** Adam's word: a player who wants to explore India goes there and rolls there. The
page lets the die rest anywhere, and the server reads the ring as it reads the looking circle today. Ground the house
has revealed counts, and a ring with none in it is the one omen *Unknown*. Nothing is refused and nothing is moved.
*Unknown* can one day open a pool of its own, for exploring.

## The physics: is it worth it, and how

Researched on 2026-10-22.

**What was measured.**

- Sizes: each package's shipped files, gzipped in memory.
- WebAssembly: compiled, not run, in Node 24 on this machine.
- A hand-written die: 92 lines, thrown 1,000 to 2,000 times at each setting.

No package's code was run. A figure for an engine's own step is therefore an estimate, and says so.

**The answer: yes, and cheaply, by hand.** One die on flat ground needs no physics engine. A cube of eight corners,
gravity, a bounce and friction against a plane, and a tumble, is about 90 lines. Measured:

| | |
|---|---|
| A step | 5 to 9 microseconds |
| A throw settles in | a median 0.8 s, 99 in 100 within 1.5 s; none of 2,000 failed to settle |
| A whole throw's work | 1 to 3 ms, in all |
| A drop from three die-heights rests | a median 1.5 die widths from the point under it, at most 3 |
| A throw of 1.2 m/s with a hard spin rests | 16 to 36 die widths away |
| The faces | come up about evenly: 339, 323, 332, 348, 299 and 359 of 2,000 |

Two things went wrong on the way, and are worth knowing before it is built:

- Corner impulses applied one at a time rocked the die forever. They must be accumulated and clamped over several
  passes.
- A die lying flat pivoted forever on whichever corner was a hair lower. Counting every corner within a millimetre of
  the ground as touching settled it.

A real feature adds a snap to the exact face once the die sleeps, a timeout that forces that snap, a cap on the throw's
speed, the map's units and the input: some 250 to 350 lines with their tests.

**The engines, and why none earns its keep here:**

| Engine | Download, gzipped | Notes |
|---|---|---|
| Rapier 0.21, 3D | 1,148 KB of WebAssembly, or 1,606 KB in its one-file build | twice its weight a year ago, since soft bodies came in 0.21. Its deterministic build is the only one deterministic across machines |
| cannon-es 0.20 | 36 KB | plain JavaScript, no release since 2022 |
| matter-js 0.20 | 25 KB | 2D only, so it has no arc, bounce or tumble: the parts that sell a throw |
| Oimo | 38 KB | dead since 2017 |
| Jolt | 892 KB | reserves a fixed 128 MB of memory, a real cost on a phone for one die |
| **By hand** | about 5 to 10 KB with its input, estimated; the physics alone is 1.3 KB | ours |

Rapier would be the one to reach for if dice ever had to strike each other or a castle. Even then it should be the
build with the `.wasm` as a file of its own, not the one-file build, which cannot be compiled as it streams in.

**Drawing it: one more layer of the sprite canvas.** The camera is orthographic: "with the field of view collapsed
the camera is orthographic, so there is no perspective divide and the projection is linear" (`cameraMath.ts`). Under
an orthographic camera every face of a cube is a parallelogram on the screen. So each face the camera can see is drawn
exactly as a flat textured shape whose corners are the cube's corners projected by `tiltGround`, the function every
layer uses. The shadow is a soft ellipse on the tilted ground.

That needs:

- no library;
- no new canvas, WebGL context or shader, the last mattering because shader compiles are what a first visit already
  waits on (0106);
- only a layer's own rule: it asks for frames while the die moves and none once it sleeps.

| Way to draw it | Cost | Over the fog, the clouds and the marks? |
|---|---|---|
| **A Pixi layer, the faces as textured shapes** | no library; 80 to 120 lines | yes, it is one of the layers |
| A Pixi mesh with a small 3D shader of its own, for rounded edges and light | no library; one small shader | yes |
| A sheet of painted frames | no code, but frames to paint, and it cannot show an orientation the physics chose | yes |
| A cube of six HTML elements with CSS 3D transforms | no library; 60 lines, and seams at the edges | yes, over the canvases |
| three.js as a MapLibre custom layer | 120 to 190 KB, and its own shader compiles | **no**: MapLibre draws under the Pixi canvas, so the fog, the clouds and the marks would cover the die |
| three.js on a canvas of its own | the same, and a second WebGL context | yes |
| pixi3d | does not support Pixi 8; its author declined | - |

**Height, seen from straight above.** From zoom 7 out the camera looks straight down, and a die held in the air sits
exactly over its shadow, so its height cannot be seen. There are two ways out, and the spike tries both:

- **Draw the die at an angle of its own**, as the standing scenery is drawn (`standingLayer`). Its height becomes a
  lift up the screen whatever the map's tilt.
- **Fake the perspective.** The die grows as it rises, and its shadow slides away along a slanted light.

**The map's units.** *Amended on Adam's word of 2026-10-22, at the spike:* "can we make it so that it about as big as a
tree sprite when it lands on the map? so when the player releases it, it becomes slightly larger, it grows, then it
becomes smaller as it falls towards the earth. if we are fully zoomed out -> it becomes a pin-mark as it becomes to
small." So the die is the size of a hand where it is held, near the eye, and the size of a tree where it lies, a thing in
the world that grows and shrinks with the zoom as the trees do: two world units wide to begin with, against trees of two
and a half to five tall. Between, its size follows its height. Let go, it is tossed up a little and grows, then shrinks
as it falls. Out where the map draws only marks, from zoom 7.5 (`BECOMES_A_MARK_AT`, decision record 0096), a die on the
ground would be a speck, so it is a pin there, its number on the pin's head, and the player zooms in to see it.

**The flight.** *Amended again the same day:* "the physics feel is unsatisfying when throwing from a high altitude. We
want to see the arch. If starting from a high altitude, then it should travel vast distances before even starting to
fall, it should be a continuous arc. just scaled up, as with a flick from near the ground." So a throw has two parts
(`sprites/die/flight.ts`, then `physics.ts`):

- **Its flight**, from the hand to the ground: one arc, as far on the screen as so many seconds of the flick's speed,
  up to a furthest, and in the air longer as the square root of how far it goes, so a long throw is a flick near the
  ground scaled up. It rises early, as high as a share of its length, then comes down in a long, steady fall, quickly
  over the ground as it leaves the hand and slower as it nears it, as a thing thrown away from the eye does: Adam's
  word, at the spike, "it needs to take more time in the air falling towards the ground ... it should flow steadily
  towards the surface as if thrown, and then land and bounce". It grows a little as it rises to the top of its arc and
  shrinks to its size on the ground as it falls, tumbling, quickly just after the top and slowly near the ground. Far
  out, where it lies as a pin, it shrinks to almost nothing, six pixels, and becomes the pin in the air a while before
  it lands, about five sixths of the way through its flight at zoom 6.5, and the pin falls the last of the arc, strikes
  and bounces: Adam's word, at the spike, "now it becomes a pin just as it bounces when tossed from up high. I want it
  to become a pin earlier, and also shrink faster after its apex. IT shrinks to almost nothing and at that point it
  becomes a mark, and then it shortly hits the ground and bounces just as it does now". A drop is the same arc with no
  length: a little rise, and down onto the shadow.
- **Its time on the ground**, where the arc ends: it strikes, and bounces and rolls by the physics. *Amended once more:*
  "I think we will get a sense of scale if we make sure it has some sideways travel left as it is a mark. maybe a big
  bounce or two if thrown from a great height." So the flight slows over the ground as it comes down but never to a
  stop: it strikes still going, at a share of its mean speed, and goes on along the ground at that speed, so the flight
  and the bounce are one motion and a mark far out lands sliding. It strikes as hard as though it had fallen a share of
  the height its arc rose from, and harder the further it fell: for every halving of its size between the hand and the
  ground, so much more again. Then, at the spike: "if i do a really meek throw now it looks exactly like i want it. But
  as soon as i throw harder it bounces way too much". So the strike and the speed it goes on with each stop growing at
  about a meek throw's, as though from 50 pixels and 90 pixels a second: a hard throw flies further, and lands as a meek
  one does, a little livelier. The bounce is worked out on the screen's own scale, a unit being as wide as the die is
  drawn, a pin's width far out, so a bounce far out is one the eye can see, and the place it rests is turned back into
  the world from there. The ground's friction is light, 0.1: at 0.3 a hard strike on a corner kicked the die any way at
  all, a third of the throws back toward the hand, and a test holds that a throw from far out goes on the way it flew
  however it lands. What stops a die sliding on a face is the grass holding it instead, a drag on its speed every
  moment it touches the ground: a strike touches for an instant and keeps nearly all its speed, and a slide touches all
  the time and stops within a die width or two. Without it, light friction let one throw in four far out skate on for
  four seconds and 400 pixels. Measured on the spike's defaults, at zoom 6.5 a throw of 600 pixels or more bounces about
  38 and 15 pixels high and goes on about 130 pixels, 240 at the most, and a meek one of 250 about 33 and 19, going on
  about 85. Close in, where it lands as a die, those pixels were a pin's: just past zoom 7.5 the die is six to sixteen
  pixels wide, and a hard throw hopped three and a half of its widths and slid fourteen, and Adam saw it: "at high zooms
  now -> it bounces too much again". So a die's strike and the speed it goes on are held to its own widths too, as
  though from three of them at most and four a second, and it is no harder for the height it fell from: at zooms 8 to
  10 a hard throw hops about two thirds of the die and slides two or three of it, at 11 a third and a half.

All of it is worked out the moment it is let go:

1. The page keeps the Mercator point under the release, and the flight's arc and the physics' path are both pinned to
   the ground from it.
2. Each frame, the die's ground offset turns back into a place, and the die is drawn with `toScreen`.
3. The die is therefore pinned to the world. A camera moved during the throw needs no special case: the die flies over
   the same ground.
4. The resting point is the release point plus the offset, the same answer `map.unproject` would give.
5. The map stays flat to the die. Its height only shades it.

**Striking what is drawn on the map.** Adam's question of 2026-10-22: how hard it would be, and what it would cost, for
the die to strike every sprite painted on the map. In short, **almost nothing to run, and a moderate amount to write**,
with two questions of feel that only the spike can answer.

- **What there is to strike.** From zoom 7.5 in, the scenery's trees, bushes and stones, the structures, the
  settlements' buildings, the bridges and the ruins. Out from 7.5 the map draws only marks (0096), so a die thrown there
  strikes nothing.
- **The page already holds what it needs.** The scenery's points are filed in cells of a zoom-7 tile each, worked out
  once per piece of ground (`sprites/scenery/sceneryCells.ts`). Every structure stands on a footprint
  (`sprites/standing/footprint.ts`, 0110). So the die asks only the cells along its path, and no new index is needed.
- **How many at once.** A forest at zoom 10 draws about 4,600 sprites on a 1920 by 1080 screen (0106). Within a die's
  width of the die, in the densest forest, that is about a dozen.
- **What it costs to run.** Each sprite is a simple shape: a tree an upright post at its foot, as tall as its crown, and
  a building a box on its footprint. Testing the die's corners and edges against a dozen of them is a few microseconds a
  step. Gathering the shapes along the throw when it is let go is under a millisecond. No frame would notice either.
- **What is hard.**
  1. **Scale.** Asked when the die was a fixed size on the screen, which made it bigger than the trees it would strike
     from zoom 8 out. Since it lies on the ground the size of a tree, at every zoom (*The map's units*), it strikes them
     at their own scale.
  2. **Code.** A box against an upright post, by hand, is 100 to 200 lines more, with corner cases such as an edge
     meeting a thin trunk between two corners. This is where an engine begins to earn its keep, though 1.15 MB of Rapier
     is still a great deal for it.
  3. **Aim.** A throw into a wood would bounce from tree to tree and stop short. That may be fun, or it may take away
     the aim the die exists to give.
  4. **Arrival.** The throw is worked out when it is let go, so trees still arriving as the ground is drawn would be
     missed.

The spike tries it on a switch, buildings first and then trees, close in, and Adam decides by feel.

**The gestures.**

- The repository's own pattern is `areas/AreaOverlay.tsx`: `preventDefault` on `pointerdown`, `dragPan` and the pinch
  turned off while the die is held, and the click the drag becomes swallowed.
- A drop and a throw are told apart by the speed over the last 50 to 100 ms. If the pointer had stopped 50 to 80 ms
  before letting go, it is a drop.
- `touch-action: none` goes on the element the touch starts on. A system's edge swipe sends `pointercancel`, which puts
  the die back.
- Keyboard and tap-only paths: Enter drops the die at the view's centre, which is exactly today's Take action, and a tap
  drops it.
- Each of these must be tried on a real iPhone and a real Android phone.

**Trust.**

- The established dice libraries that show a result decided elsewhere do it by simulating first, then relabelling the
  faces and playing the throw back. That needs the result before the throw. Ours depends on where the die lands, so it
  can only come afterwards.
- Owlbear Rodeo, the dice of a shared online map tool, let the client's physics decide, and in its 2.0 replaced
  drag-to-throw because players nudged dice to the number they wanted. Here that is harmless, because the physics
  decides nothing.
- Rapier has no JVM binding, and the server has nothing to check that its own rules do not already bound. So, as
  above, no seed and no replay.
- Other players never see a throw. Sending one would be cheap later, about a kilobyte of its path.

**The feel comes from juice, not accuracy**, the lesson of Balatro, Dicey Dungeons and the "juice it or lose it" talk:

- a squash on each bounce;
- a puff of dust where it strikes;
- an overshoot as it settles on a face;
- a beat before the reveal.

The spike has these on a switch.

**What it costs, all told:**

| | At startup | At the first throw | Each throw |
|---|---|---|---|
| **By hand, drawn by a Pixi layer** | nothing: it is fetched after the game has started, as what is kept off the start already is (`started` in `PixiSpriteRenderer.ts`) | about 5 to 10 KB of code (estimated), and the faces' pictures, 10 to 40 KB, or none if drawn in code | 1 to 3 ms of physics in all; 15 to 40 microseconds a frame for about a second |
| cannon-es, drawn by a Pixi layer | nothing | about 40 to 45 KB | the same order |
| Rapier and three.js | nothing, if fetched late | about 1.3 to 1.4 MB, a second WebGL context and three's shader compiles | the same order |

**The risks, by hand:**

1. **The look.** Flat faces may look plain beside the painted world. Painted faces with rounded corners, a darker
   outline and a little rim light help, and the next step up is the small shader.
2. **Reading height from straight above.** This is settled at the spike.
3. **The physics' corner cases.** The two found are fixed, and a timeout snaps a die that will not settle.
4. **Phones.** The fixes are known, and each must be tried on real phones.

**Sources**, read directly unless marked:

- Sizes and dates: `npm view` for each package; the shipped files from `https://cdn.jsdelivr.net/npm/<package>@<version>/`.
- Rapier: the TypeScript changelog, https://github.com/dimforge/rapier/blob/master/bindings/typescript/CHANGELOG.md;
  determinism, https://rapier.rs/docs/user_guides/javascript/determinism; the old bindings' repository, archived on
  2026-07-12, https://github.com/dimforge/rapier.js.
- Jolt's memory and build flags: https://github.com/jrouwe/JoltPhysics.js and its `CMakeLists.txt`.
- cannon-es: https://github.com/pmndrs/cannon-es.
- pixi3d and Pixi 8: https://github.com/jnsmalm/pixi3d/issues/209. 3D is not part of Pixi 8.16:
  https://pixijs.com/blog/8.16.0.
- Pixi's mesh: https://pixijs.com/8.x/guides/components/scene-objects/mesh. Pixi and three.js together:
  https://pixijs.com/8.x/guides/third-party/mixing-three-and-pixi.
- MapLibre's custom layers, in its examples in https://github.com/maplibre/maplibre-gl-js. `DragPanHandler`, whose
  `disable()` resets a drag in hand: https://maplibre.org/maplibre-gl-js/docs/API/classes/DragPanHandler/.
  `MercatorCoordinate`: https://maplibre.org/maplibre-gl-js/docs/API/classes/MercatorCoordinate/.
- Forcing a face:
  - `threejs-dice`: https://cdn.jsdelivr.net/npm/threejs-dice@1.1.0/lib/dice.js;
  - `dice-box-threejs`: https://github.com/3d-dice/dice-box-threejs;
  - `dice-box` on determinism: https://fantasticdice.games/blog/roadmap-2023.
- Owlbear Rodeo's dice: https://blog.owlbear.rodeo/owlbear-rodeo-2-0-dice-deep-dive/ and
  https://github.com/owlbear-rodeo/dice.
- Pointer events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events and
  https://www.w3.org/TR/pointerevents3/. Passive touch listeners:
  https://developer.chrome.com/blog/scrolling-intervention.
- Our own: `geometry/cameraMath.ts`, `sprites/PixiSpriteRenderer.ts` and `areas/AreaOverlay.tsx`.
- *Seen in search summaries only:*
  - Roll20 showing the server's roll in its 3D dice;
  - D&D Beyond's move from three.js to Babylon.js;
  - Android's `VelocityTracker`, a least-squares fit over about 100 ms.
- *From memory, unchecked:*
  - that CSS 3D with no perspective is parallel;
  - Google's die and Dicey Dungeons;
  - the juice talks, Jonasson and Purho's "Juice it or lose it" and Nijman's "The art of screenshake".

## How it meets the rest

### Building actions

The landing is what a building action needs: a place the player chose, which the server read and kept.

- A new kind of action in the catalogue raises a structure, `"raises": "<type>"`.
- It is dealt only when the landing is ground the house may build on. That means revealed land, no water, and clear of
  other structures, settlements and roads, the rules a bot's seat keeps already (`HouseBotPlaces`, 0114, 0115). It may
  also mean within reach of a holding.
- Its option names the place, *Raise a mill by the Vistula*, and carries it.
- Taken, the house's `PlayerTookAction` records it. A listener then raises the structure for the house at the landing,
  under an id worked out from the option, as the seats listener raises a founding's castle.
- What it costs and how long it takes are the Structure entry's open question *Building one*.

That is its own plan, after this one has been played. **This plan's part:** the landing reaches an action as it is
dealt, `Moment.landing`, and the hand remembers it, on `yourChoice` and on the event.

### Pools that change

**Static today.**

- There is one catalogue, `world/catalogues/fate.json`: six pools and 21 actions, the same for every house in the world.
- Adam retunes it while the server runs (0097), and every house deals from the change at its next roll. Nothing is
  locked or unlocked for one house.
- The one filter at a moment is an action's own dealing, which may come back empty, as the gossip does when no house is
  near. The hand is then drawn without it.

**How unlocks would fit.**

- An action in the catalogue gains `needs`: a condition the house must meet as it is dealt. It might hold a structure
  of a type, have a key figure with a stat, or carry a mark of progression.
- The condition is worked out from what the house is, as the gossip's is, so it needs no event.
- An unlock that is a fact of a story, such as a quest's reward that teaches masonry, becomes an event on the house's
  stream, which the condition then reads.

That is its own plan, and nothing here stands in its way: the engine already deals an action at a moment, for a house.

### The roll's payload, and the wire

- `roll` gains `landing` and loses `centre` and `zoom`.
- The choice view of `yourChoice` gains `landing` and `circleKm`.
- `PROTOCOL_VERSION` goes up once, from 69, and `contracts/protocol-v70.txt` is written. The number is checked against
  main's at the time, because other branches take numbers while one is out.
- The fixtures gain a roll with a landing, and a rolled choice with one.
- The load bots in `backend/load-bots` drop their die at their seat, where they look today.

### The house AI

**A house bot rolls by the same command, with a landing, and no die.** There is no physics on the server, so
a bot's roll is a player's roll without the flourish: the same reach, the same fog, the same odds.

**Its aim is the landing it chooses.** What a landing would open can be read without rolling: the omen sources over a
moment, and the pools those omens open. Step 5 makes this a call of the fate engine's own, `FateEngine.opens(moment)`.
A house AI looks for the landing that opens the pool holding the action it wants, nearest its seat or the place it
cares about, and drops there:

- a river for Coin;
- a forest for Land;
- once building actions exist, the very spot it wants a building on.

Kolín's road to *an abbey within reach of Prague* (game-ai plan, house-ai) gains a road through the roll: drop the die
where the abbey should stand, and take *raise an abbey* when it is dealt.

The house AI's plan, as it stood at 12:09 on 2026-10-22, recommends that a bot does not roll yet. Adam's later word, that
a house AI acts mainly through the roll, outranks that. This plan gives that the command and the query it needs, and
changes nothing in the game-ai plan, which its own session keeps.

## The rules that must hold

| Rule | Held by | When |
|---|---|---|
| The odds are the balance's alone: no omen, the landing included, moves the rarity | the fate engine, which draws the rarity before it opens a pool. A spec rolls the same dice with two landings and gets the same rarity | at once, before the command |
| A roll is paid once, when its die has landed; a die put back costs nothing | the house's stream: `Roll` spends the price in the decision that records the roll, and a die put back sends nothing | at once |
| Only ground the house has revealed is read, under the die and round it | the map's omen source, against the house's sight (`Seen.kt`) | at once; a roll reads a little less than the fog draws, never more |
| Nothing the server reads is the page's word but a point and what is open | the `roll` payload, which has no field for an omen, and every source checking what the page names | at once, by construction |
| A roll's landing is the one its hand was dealt at | the one decision that records the roll and gives the hand | at once |
| The landing circle always reads the ground under the die, however narrow it is, where the house has revealed it | the map's omen source, which reads the landing's own cell before any other | at once |
| One roll pending at a time | the house's stream, `ChoicePending`, as today | at once |
| A bot's roll reads no more than a player's would at the same landing | the one `RollService` and the one list of omen sources, which every roll goes through, bot or player | at once |
| Every option of a hand is of the rolled rarity, and names only the roll's omens | the decider, as today | at once |
| *Next plan:* a building raised at a landing stands on revealed land a house may build on, clear of every other structure | the deal checks it, and the use case checks it again when the option is taken. Clearance spans every structure's history, so two houses taking in the same instant could both pass | a moment after; harmless and rare, and its plan says how it is put right |

## The steps, one commit each

Step 1 is this plan. Bringing the work to main is the implicit last step.

| # | Step | Verification requests |
|---|---|---|
| 1 | **The plan.** This document, with the terms put to Adam | Read the plan and answer the questions by number |
| 2 | **The spike, `/admin/inspect-die`.** The hand-written die on a still of the painted map, at a tilt from 0 to 45 degrees: picked up from a podium by a long press, hanging under the pointer or the finger, dropped, thrown, and put back in its slot. Its height drawn both ways: at an angle of its own, or growing as it rises. Its numbers on sliders: gravity, bounce, friction, spin, size, the fastest throw, and where a drop becomes a throw. The same chosen number coming up on every throw. On switches: its juice, and striking the buildings and the trees. Where it rested, and how long its physics took | 👀 At `/admin/inspect-die`, drop the die and throw it with a flick: do the drop's stray, and the throw's arc, bounce, roll and reach, feel fun? Does the chosen number come up every time? 👀 At a tilt of 0, which shows the die's height better: its own angle, or growing as it rises? And with striking switched on, is a throw among the buildings and the trees better or worse? 👀 At phone size, or on your phone: does a long press pick it up, a flick throw, and letting go drop? |
| 3 | **The documents.** A decision record, *a roll is aimed by where its die lands*; the *Choice roll* entry in `MECHANICS.md`, Take action becoming a die on a podium; *die*, *landing*, *landing circle*, *throw* and *drop* in `GLOSSARY.md`, *looking circle* giving way; the fate engine in `ARCHITECTURE.md`; the rolled event's fields in `EVENTS.md`; the engine the spike chose, and whether the die strikes what is drawn | Read the decision record and the new *Choice roll* entry |
| 4 | **The landing on the wire and on the event.** `roll` gains `landing` and loses `centre` and `zoom`, and the event and `yourChoice` gain `landing` and `circleKm`; version 70 and its recording; fixtures; the load bots. The page sends its view's centre as the landing for now, and the Choice roll section of the debug panel says where each roll landed and how wide its circle was | 👀 Take action: the Choice roll section says where the roll landed and how many kilometres its circle reached; the events log shows `rolled` with its landing. The checks |
| 5 | **The landing circle.** The map's omens read 25 km round the landing at every zoom, `omens.landingCircleKm` in the balance; the ground under the landing always read; `FateEngine.opens`, what a moment would read and open without rolling, for the house AI. Still landing at the view's centre | 👀 On a river you have revealed, Take action at any zoom: the report card names the river, and the Choice roll section says the circle was 25 km. 👀 At `/admin/inspect-balance`, change the circle's width: the next roll reads that width. 👀 On unrevealed ground: *Unknown*, and the roll goes through |
| 6 | **The podium, in the library.** The die standing on its podium over *Take action* and the price; its empty slot; greyed with its reason; the long press as it fills. Shown at `/admin/inspect-ui-components` in every state; the podium's picture a placeholder in `world/ui/`, copied from the moodboard, at the size the step says | 👀 At `/admin/inspect-ui-components`: the podium with its die, empty, and greyed, readable on parchment and on night, and the long press showing it is about to lift |
| 7 | **The die on the map, dropped.** The podium takes Take action's place in the pane; a long press picks the die up, and it is drawn by a layer of the sprite canvas from the spike's code, fetched only after the game has started. Its shadow and its breathing ring, by the selection ring's shader; a drop on a desktop and on a phone, and Enter at the view's centre; back into its slot for nothing; the roll sent from where it rests. `perf:startup` compared with main's last point | 👀 Long-press the die on its podium and drop it on a river: the report card names the river. 👀 Pick it up and let it go over its empty slot: nothing is paid. 👀 At phone size, the same with the finger. The startup measure: no change |
| 8 | **The die thrown.** The flick on a desktop and on a phone, the speed read over its last 100 ms; the pips painted as the throw is worked out; the juice the spike settled; striking what is drawn, if the spike kept it | 👀 Throw the die with a flick, on a desktop and at phone size: it flies, bounces and rolls, and the report card reads the ground round where it stopped |
| 9 | **The die where it fell.** It lies at its landing with its ring while the hand is open, after a reload too, and goes back to its podium once the hand is answered | 👀 Roll, leave the hand open and reload: the die lies where it fell and the podium's slot is empty. Answer it: the die fades and stands on its podium again |

Steps 4 and 5 are the server's half and work with no die at all, which is what a house bot needs. Steps 6 to 9 are the
page's half.

## Not in this plan

- Building actions, and what building costs and takes: their own plan (question 16).
- Unlocks, the pools that change per house: their own plan.
- The later landing kinds: a holding, a town's ruin, a settlement, a road.
- A die that rolls down the relief, on the world's height. The map is flat to the die; the height only shades it.
- Other players seeing a throw. A throw's path is about a kilobyte, and could be sent later.
- A sound for the die. The game makes none yet.
- Dice that strike each other, which is where an engine would first earn its keep. Striking the buildings and the trees
  drawn on the map is tried on the spike's switch, and kept or not on Adam's word.
- What the pips' number means. The first version paints a number the page chooses.
- A landing circle that grows with progression.
- Changes to the house AI's plan, which is its own session's. This plan gives it the command and the query.
