# 0072. A file over 400 lines may only get shorter

- Status: accepted
- Date: 2026-10-02

## Context

The review of 2026-10-02 found the layers between modules sound and enforced, and the decay one level down:
every mechanic was threaded by hand through the same shared files, and each of them grew with every mechanic.
`styles.css` had changed in 59 of 209 commits, `Gateway.kt` in 44, `App.tsx` in 40, `net/gateway.ts` in 34
and `Ports.kt` in 30. The commits for resources, characters, fog of war and dialogue each edited at least twelve
of the same thirteen files, and the edits were logic rather than a line on a list: 79 lines into `Gateway.kt`
to send dialogues, 44 to 70 into `Ports.kt` per mechanic, 163 lines of stylesheet for the dialogue pane.

Nothing pushed back. A long file is the easiest place to add the next thing, so it got the next thing, and a
review is the first time anybody counts. The fix for each file is its own step, and a structural one; what
was missing was anything that stops the files growing while those steps are taken, and after them.

## Decision

**No source file may pass 400 lines, and one already past it may only get shorter.** `size-ceilings.txt`, at
the repository root, lists every source file over the limit with its length when it was listed. Two tests
hold the repository to it, `SizeCeilingsSpec` in `backend/arch-tests` for the Kotlin files and
`frontend/tools/sizes.test.ts` for the rest - TypeScript, stylesheets, scripts - and both fail when:

- a listed file grows;
- a listed file shrinks and its number has not come down with it;
- a listed file is down to 400 lines or fewer and is still listed;
- a file that is not listed passes 400 lines.

Tests count as source: a spec that every mechanic adds a case to is a shared file like any other. Data and
documents do not. A line is counted as an editor numbers them.

The number is 400 because the files every mechanic grew were all past it, and the files nobody had to touch
twice were under it. It is a limit on what a file can become, not a target for what it should be.

## Consequences

- A change that needs room in a listed file moves something out of it first: into a file of its own, which is
  exactly where a mechanic's part was always meant to go. A new mechanic cannot grow `Gateway.kt` by a line.
- The list is a record of the work. Every step that splits a file lowers its number in the same commit, and a
  file that drops off the list has been split for good, because it cannot creep back past 400.
- A one-line fix inside a listed file costs a line moved out of it. That is the friction, accepted knowingly:
  the alternative is the file's growth starting again one exception at a time.
- The two halves have to agree on what a line is and which files are whose; the split is by extension, and
  the Kotlin half also fails when the build includes a module it does not measure.

## Alternatives considered

- **A lint rule such as `max-lines`.** It covers only the TypeScript, and a fixed limit without a list would
  have meant either failing today on 35 files or a limit high enough to mean nothing.
- **A warning instead of a failure.** Warnings are read the first week. The checks in this repository fail,
  and say what to do, which is why they are kept.
- **A budget per commit**, so many lines a change may add to a long file. More to explain and more to work
  out, and it still lets the file grow.
