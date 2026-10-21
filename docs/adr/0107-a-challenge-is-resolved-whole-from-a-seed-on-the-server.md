# 0107. A challenge is resolved whole from a seed, on the server

- Status: accepted
- Date: 2026-10-20
- Plan: `docs/plans/challenges.md`
- Builds on 0083, which keeps the luck in the application and the rules in the domain, and on 0076, which
  closes Adam's instruments on a server players use

## Context

Adam described the challenge on 2026-10-20: two sides measuring their strength along a dimension, a tug of war
from -100 to +100 pulled by the slices each side brings, over a progression of happenings whose aspects decide
which slice stands forward and which is boosted. He settled its rules over thirty-four questions. It is resolved
at once and played back as a spectacle, and it is wanted for battles, debates, trade wars and sermons alike, so
its outcome goes to whatever raised it.

His word was that the first iteration is not in the game: it is tried on an admin page with a simulator before
any pane is made. And that the program is event sourced, so the engine has to be one whose result can be
recorded when challenges do reach the game.

Three things had to be decided before anything is built: where the engine runs, how a run is made repeatable,
and what the store will hold.

## Decision

**The engine runs on the server, in Kotlin, in the domain.** A challenge is a game rule, and the server is where
rules are decided; written in the page first it would be written again for the server and the two would drift,
as the Rolls page's deal can drift from the fate engine today. It is a package of the domain's own,
`villages.domain.challenge`, because what a challenge is made of - slices, a progression, an outcome - will be
the payload of its event, and an event's payload is the domain's.

**A run is a pure function of its setup, a seed and the catalogue in force**: `Challenge.resolve(setup, seed,
catalogue, rules)` gives every moment and the outcome, and the same four always give the same run. The numbers are
drawn by a SplitMix64 written out in the domain, pinned by its published reference values, rather than
`kotlin.random`, whose sequence a new Kotlin may change, for the reason `FoundingChoices` chose `java.util.Random`.
**Choosing the seed is the luck, and it stays in the application** (0083): the page gives one now, which is an
instrument and so allowed to; the server will draw one when the world raises a challenge, never from anything a
client sends.

**In this iteration the engine is reached only by Adam's instruments.** The page sends `simulateChallenge` on a
socket with no hello and is answered alone with `challengeSimulated` or `simulationRefused`; a server run with
the instruments closed refuses it. Nothing is written to the store.

**When challenges reach the game, one event records one challenge**, `villages.challenge.resolved.v1` on a stream
of its own, `challenge:<id>`, because a challenge is shared between its sides. It carries the kind, the
progression, both sides' slices, the seed, the catalogue version, the engine's version and the outcome. **The
outcome is the truth**: what the world does about a challenge is read from it and never worked out again, so a
change to the engine or the catalogue never moves the past. The moments are not stored; the spectacle is played
again from the rest, and is only certain to be the same while the engine's version is.

The names of every event the challenge will bring were agreed with Adam now, before any is built:

| Event | Stream | What it means |
|---|---|---|
| `villages.challenge.resolved.v1` | `challenge:<id>` | A challenge was fought out and settled |
| `villages.structure.damaged.v1` | `structure:<id>` | A building lost a tenth, with its effectiveness now |
| `villages.character.fatigued.v1` | `character:<id>` | A person lost a tenth, with their effectiveness now |
| `villages.house.gainedSlice.v1` | `house:<id>` | A house came to hold a slice |
| `villages.player.fittedSlice.v1` | `house:<id>` | A player chose a slice's effects and what stands in its slots |

What a challenge loses lands on the losers' own streams - a building's on the structure's, a person's on the
character's - a moment after the challenge is recorded, by a listener, because no one decision writes two
streams. Until it acts the building still reads whole, which costs nothing, since nothing reads its
effectiveness before then.

## Consequences

- The simulator needs the game server running, which the quick start does. In exchange, what Adam tunes on the
  page is the engine the game will use, and a number saved in the catalogue is taken on within a second.
- An effect's behaviour is code and its words and numbers are the catalogue; the shelf refuses a catalogue
  naming an effect the code lacks, or lacking one it has.
- The five event names are not in `docs/EVENTS.md` until they are built, because its spec holds the catalogue to
  the code; this record and the plan hold them until then.
- A seed replays a run only on the engine that made it. A stored challenge read after its engine changed shows
  its outcome as recorded and a spectacle that may differ, and the engine's version says so.

## Amendment, 2026-10-21: every slice meets every happening

The first rules put one slice of each side on stage at each happening - one of its aspect, else one of its
anti-aspect, else one drawn - and only that slice did anything, boosted in its aspect's happenings and its
anti-aspect's alike. The matchup grid showed what came of it: a slice was judged by which happenings found it, and an
aspect whose effects needed the stage, Authority, lost almost everywhere.

Adam's word replaced it. **Every slice meets every happening.** A slice's **aspect matches** while the latest
happening has it, so a side may have several matching slices or none, and only a match is boosted. Whether an effect
works where its aspect does not match is the effect's own, by a mark, **needs a matching aspect**, which kinds of
summon carry too; the agent set the first marks and the page ticks them. The anti-aspect leaves the engine and becomes
a rule of design: a slice is made to meet its anti-aspect's happenings well, through its effects, and not boosted
there. *Against the Grain* and *Will of One's Own*, which leant on the draw, keep their nearest meaning.

`Challenge.ENGINE` is 2. The moments say which slices match at each happening, and what sits out. No event changes:
nothing is stored yet, and the agreed `ChallengeResolved` carries the engine's version. The plan is
`docs/plans/challenge-matching.md`.
