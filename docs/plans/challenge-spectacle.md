# Challenges, part three: the spectacle

**What belongs here:** how a challenge comes to be watched - the diorama it is played out in, the venue that comes
first, the components it is built from, how the field at each second is found from the moments, the rules that must
hold, and the order it gets built in. **What does not:** what the mechanic is for, which is `MECHANICS.md`; why it is
shaped this way, which is decision record 0116; the words, which are `GLOSSARY.md`; the rules of the engine, which are
`challenges.md` and `challenge-matching.md`. When a part of it is decided, that part becomes a decision record and
leaves.

Planned on 2026-10-21 from Adam's word, after the wireframes of the diorama on the design canvas
(https://claude.ai/artifact/4Gy7dLHst9K8tPGYFFnSvo, the right-hand column).

---

## The spectacle, in one paragraph

A challenge is played out in a **diorama**: a small piece of the world seen as the map sees it, from the south and
above, built from the map's own pictures, where the summons stand, act and fall and the tug is drawn on the ground.
Everything else - each house's slices, the history, the controls - folds away round it. Each kind of challenge is
shown in a **venue** of its own, and the first is **the square**: a sermon in a town square, each house's speaker on a
platform and the townsfolk walking over to whoever is winning them. Adam chose it over the battle because the game is
not to be battle focused. It is watched first on `/admin/inspect-challenges`, playing the run just simulated, and it
is built from the component library, each piece shown on `/admin/inspect-ui-components` before it is used.

## Adam's answers

Given on 2026-10-21:

- **The square first**: "Its so easy to get stuck in 'battle' but as ive said before, i dont want this game to be
  battle focused."
- **Every control a mark**: play and pause, the pace, to the end, and the one that opens the history.
- **Watched on the challenges page**, above the moments table.
- **Venues in code until there is a second**, then a catalogue of their own, `world/catalogues/venues.json`, with
  its page, and each challenge kind naming its venue.

## Who stands where

The camera looks north and down, so a figure can be drawn turned toward us or across, never away: the near side of a
face-off up the screen would show us its back. So the two houses never face each other up the screen. **Each holds a
bank**, left or right, and both are turned three-quarters toward us, as actors open to an audience. Held wide, in
landscape, the stage is wide; held deep, in portrait, the same two banks are made deep, the ranks one behind another
up the screen, and what lies between them still runs up the screen and moves left and right. A figure is drawn once,
facing south-east, and the other house's is that one mirrored; a building is never mirrored, because its light would
move from the upper right to the upper left. Decision record 0116.

## The tug, drawn as a share

The tug is drawn as a share of something, never as a knot on a rope: of the bar at the top, of the townsfolk in the
square, of the ground at a ford. At 28 toward Varga, Varga has 64 parts in a hundred. A rope's knot moves toward the
winner and ground held moves away from them, and both on one screen would move against each other; a share moves the
same way everywhere.

## The square

Held wide and held deep, in the units of the venue, and scaled to its box:

- **At the back**, the map's own palace, market and manor, among the map's own trees, in the culture of the place the
  challenge is fought - European on the admin page, which has no place.
- **Two platforms**, one on each bank, drawn stand-ins until they are painted. On each stands the house's **speaker**:
  the first key figure in its slices' slots, or a stand-in speaker when it has none.
- **Each house's summons** stand beside its platform, and a thing put on the line stands at its edge, the map's own
  picture of it.
- **Twenty townsfolk** between them, each with a place on either side. Their share on each side is the tug's, so a
  lead is seen at a glance and a swing is people crossing the square.

## The parts, in the library

Each one in a commit of its own, shown on `/admin/inspect-ui-components` in a section of its own, Challenges, in every
state, on both grounds and at both widths. Each is a container named by a recipe; a step that adds one says the
pictures it reads, their paint size and which are placeholders. The library imports nothing from the game, so a house's
colour, the words and the callbacks come in from the spectacle.

| Part | What it is |
|---|---|
| **The marks** | The ten aspects' marks, each a different outline before a different picture, and the replay's: play, pause, to the end, three paces and the history. Drawn in code in `ui/mark/Mark.tsx`, as every mark is |
| **The slice chip, its tray and the opened slice** | A chip per slice: its aspect's mark and name, and whether it matches (lit, Empowered), answers its anti-aspect, works or is idle, with the pips of what it bears. A house's tray: its name, the fold mark, its chips in a row or a column. A slice opened: its two effects, what each needs and whether it works now, its slot, its power, integrity and summons. `ui/slice/` |
| **The tug bar and the happening plate** | The tug as a share in the two houses' colours with what it says riding the split; and the happening: its marks, its name, its seconds, and who it matches. `ui/tug/` |
| **The replay bar** | Play and pause, the pace and to the end; the happenings as bands with the tug drawn over them; a tick where something arrived or fell; and the scrub, which the arrow keys step a second at a time. `ui/replay/` |
| **A figure on the field** | A head over a widening cloak in a house's colour, facing east or west and no other way, lit when Empowered, with the pips of what it bears and the number it pulled rising over it, fallen, a key figure with a circlet, or a townsperson in no colour. `ui/fieldFigure/` |
| **The diorama** | Pictures cut from the map's sheets, each standing on its foot, in front of what is behind it, scaled to its box, with figures and drawn pieces among them. It has no way to mirror a picture. `ui/diorama/` |
| **The drawer** | What the history mark opens: from the right held wide, from the bottom held deep. `ui/drawer/` |

## The spectacle

A folder of the game's own, `frontend/apps/web/src/spectacle/`, the player's surface to be: in the fifth row of
`src/layers.test.ts` with the game's other surfaces, taking up the library, and one of the folders an inspect page may
take from (`admin/boundary.test.ts`).

- **`replay.ts`** finds the field at every second by folding the moments up to it: who stands there (a summon from
  `summoned`, on its hiring slice's side; a thing put on the line from `arrived`; `killed`, kept three seconds as it
  fades; `turned` to the moment's side; `deserted`, gone), what each bears and until when (`buffed`, `debuffed`,
  `lifted`, `cleansed`, and the seconds running out), each slice's state, the tug, and what each pulled in the second.
  A summon's kind is the frame's `summons[]`; a thing on the line finds its picture through what the page knows of the
  slot it came from.
- **`sheets.ts`** reads the structures' and the scenery's sheets once.
- **`venues/square.tsx`** is the square, held wide and held deep.
- **`Spectacle.tsx`** puts the diorama, the trays, the tug, the happening, the replay and the drawer together, holds the
  second shown and the clock, and is held wide or deep by the shape of its box.
- **`said.ts`** is the moments' wording, moved from the page's `setup.ts`, so the history in the drawer and the moments
  table say a moment the same way; the tug chart moves with it.

On the page, a single run's result shows the spectacle above the tug chart and the moments table, with a choice of
holding it wide, deep or as a phone.

## No events, no frames, no catalogue

The spectacle is a view of a run the engine has already fought. Everything it shows is in what `challengeSimulated`
carries - the moments, `summons[]` and the progression - or in what the page already holds: the draft's slices and the
catalogue in force. Nothing is stored, the protocol does not change, and the venue is code until the second one.

## The rules that must hold

Every one is held at the instant, in a pure view; none is put right a moment later.

| Rule | What holds it |
|---|---|
| The field at a second is the fold of the moments up to it, however it was reached - played, scrubbed back, jumped to the end | `spectacle/replay.ts`, pure; a test folds from nothing and a second at a time |
| The tug shown is the engine's after each second, and the outcome's at the end | `replay.ts`; a test against `contracts/fixtures/frames/server/challengeSimulated.json` |
| Every figure on the field has a kind | `summons[]`; a serial the frame does not name is refused, by test |
| The townsfolk's share is the tug's | the square's split, by test |
| No figure faces away, and no building is mirrored | the types: a figure on the field faces `'east'` or `'west'`, and a picture in the diorama has no flip |

## The steps, one commit each

| # | Step | Verification requests |
|---|---|---|
| 1 | **Documents**: this plan, decision record 0116, the look and feel of the challenge in `MECHANICS.md`, a picture in a diorama in `LOOK-AND-FEEL.md`, the new words in `GLOSSARY.md`, the roadmap | 1. Decision record 0116: who stands where, and the tug as a share, read as you meant. 2. The new words in the glossary. |
| 2 | **The marks**: the ten aspects' and the replay's, in `ui/mark/Mark.tsx`, on the components page | 1. 👀 On `/admin/inspect-ui-components`, the ten aspects' marks are told apart at their smallest. 2. 👀 The replay's marks read without words. |
| 3 | **The slice chip, its tray and the opened slice**, `ui/slice/`, in a new Challenges section | 1. 👀 The chip in its four states and with pips, on both grounds. 2. 👀 The tray folded and open, in a row and in a column. 3. 👀 The opened slice says what each effect needs and whether it works now. |
| 4 | **The tug bar and the happening plate**, `ui/tug/` | 1. 👀 The tug bar even, leaning, and at either end. 2. 👀 The happening plate with one aspect and with two. |
| 5 | **The replay bar**, `ui/replay/`, with its arithmetic tested | 1. 👀 The live one plays, pauses, changes pace and jumps to the end. 2. 👀 Scrubbing, by pointer and by the arrow keys. |
| 6 | **A figure on the field**, `ui/fieldFigure/` | 1. 👀 Facing east and west, in a house's colour, Empowered, with pips, pulling, fallen, a key figure, a townsperson. |
| 7 | **The diorama**, `ui/diorama/`, with a little of the map's trees, a building and figures, held wide and held deep | 1. 👀 The pictures stand on their feet, in front of what is behind them, at the map's angle. 2. 👀 It scales to its box both ways. |
| 8 | **The drawer**, `ui/drawer/` | 1. 👀 It opens from the right held wide and from the bottom held deep, behind the history mark. |
| 9 | **The replay folded from the moments**, `spectacle/replay.ts` and its tests; the layers and the inspect pages' boundary take in `spectacle` | The checks: the fold agrees with the fixture's tug and outcome, and is the same scrubbed as played. |
| 10 | **The square, watched on the challenges page** *(the first that can be watched)*: `venues/square.tsx` held wide, `sheets.ts`, `Spectacle.tsx`, and the page showing it for a single run | 1. 👀 Run the sample on `/admin/inspect-challenges` and watch it in the square: the townsfolk walk to whoever is winning them, the summons arrive, act and fall. 2. 👀 Scrub back and forth, and open a slice. |
| 11 | **Held deep**: the square's deep arrangement, the trays in columns, and the page's choice of wide, deep or a phone | 1. 👀 Held deep and as a phone, the two houses still face each other and nothing is seen from behind. |
| 12 | **The history in the drawer**: the tug second by second with the second shown marked, that second's moments in words (`spectacle/said.ts`, which the moments table reads too), and every slice's numbers | 1. 👀 Open the history at a busy second: what it says agrees with the field. 2. 👀 The moments table reads as before. |

Bringing it to main follows the last step. It adds no running part, so the architecture page is not asked about.

## Part two: the happening travels, and the run is watched for the first time

Adam's notes on 2026-10-22, after seeing the square: the happenings should stand out, larger, with the mark of their
aspect inside; the spectacle should not feel worked out beforehand, but be watched as it plays out for the first time;
and the slices should be tied to a point in time, the happenings coming out of a haze toward it and, reaching it,
sending a jolt into the slices. Of the ways offered he chose the happening **half in the world**: a thing in the venue
that is plainly also a sign.

- **The happening's seal**: a glowing medallion the size of a figure's head, the mark of its aspect large on its face,
  or both marks for a happening of two. It forms in a patch of **mist** at a spot every venue has, a few seconds before
  its happening, drifts along the venue's **path**, gilt channels inlaid in the ground, and reaches the venue's
  **receptacle** - a font in the square - at the very second its happening begins. There it sits, named, while the
  happening lasts, and fades as the next arrives.
- **The jolt**: as it arrives, light runs along channels in the ground from the receptacle to each house's platform,
  and on into the chips of the slices it lights, which flash: gold to the ones it matches, in their aspect's colour to
  the ones answering their anti-aspect.
- **Each venue says where**: the mist, the path, the receptacle and the channels to each platform, as it says where the
  platforms stand. A seal's place is worked out from the second shown alone, so a second scrubbed back to shows it
  where it was.
- **Watched for the first time**: a run starts playing by itself, from a moment before its first second so the first
  seal is seen coming. Nothing past the furthest second played is shown: the replay's tug, its happenings and its marks
  of what arrived and fell, and the history's chart, stop there, the rest under haze; the scrub reaches back over what
  has been seen, and to the end shows the rest. On the page the spectacle stands above what the run came to.
- **The happening box at the top goes** from the spectacle; the seal at the receptacle says the happening's name.

| # | Step | Verification requests |
|---|---|---|
| 13 | **The happening's seal**, in the library, one aspect or two, forming, coming, arrived and spent; these documents | 1. 👀 On the components page, the seals of one aspect and of two in their four states, the marks readable on their faces. |
| 14 | **The seal on its path, out of the mist**: the mist, and a seal's place along a path worked out from the second, tested; shown travelling in the diorama | 1. 👀 The seal forms in the mist, drifts along the path and reaches the receptacle on its second, played and scrubbed. |
| 15 | **The channels in the ground and the jolt**: channels drawn into the ground, light running along the ones a happening lights, and a slice's chip flashing as it lands | 1. 👀 On a sample, the light runs only to the platforms whose slices the happening lights, and those chips flash. |
| 16 | **Watched for the first time**: playing by itself from before the first second, nothing shown past the furthest played, the scrub over what has been seen, to the end shows the rest; the spectacle above the run's outcome | 1. 👀 Run the sample: it starts by itself and nothing ahead of the second played gives it away. |
| 17 | **The seal, its path and the jolt in the square**, held wide and deep, in place of the happening box | 1. 👀 Watch a run: each happening's seal comes out of the mist, crosses the square to the font and jolts the slices it lights. |
