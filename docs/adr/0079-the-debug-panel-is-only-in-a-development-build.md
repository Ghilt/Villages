# 0079. The debug panel is only in a development build

- Status: accepted
- Date: 2026-10-02

## Context

The debug panel is Adam's instrument: the levers that stand in for a world that does not do these things yet,
the log, the worktrees, the grips that resize the stage and the phone toggle (0023, 0039). It was in every build.
A production build carried every section of it, every word on its buttons and all six hundred lines of its
stylesheet, and a player's page would have opened with it docked down the right-hand side, taking room from the
game.

Nothing a player would ever see needs it. Step 33 of the review moved what the game reads out of `debug/` - the
camera, the scenery's dial, the stage's arithmetic - so that the panel only sets them, and by the end of the plan
the only file in the game that imported from `debug/` was `App.tsx`.

## Decision

**A production build has no debug panel.** `debug/devTools.ts` is the panel, its grips, the arrangement of the
two, and the panel's stylesheet, `debug/debug.css`, which holds the five parts of it that `styles.css` used to.
`main.tsx` imports it only when `import.meta.env.DEV`, which a production build replaces with `false`, so the
bundler leaves all of it out. `App.tsx` is handed it, or null, and with null the stage is laid out as the panel
would leave it if it were shut: the whole window, no grips, no badge. `App.tsx` imports only types from
`debug/`, which leave nothing in a build.

The development build is unchanged: the panel, the log, the grips and the phone toggle are where they were and
look as they did. The panel's stylesheet comes after the page's now rather than in the middle of it, which moves
nothing, because every rule in it is the panel's own; that was measured, element by element.

## Consequences

- A player's build is the stage, filling the window, and the two admin pages. `/admin/inspect-events` stays in
  it: it is a page of its own, and it is how the world is read without playing in it. So does the component
  library's page, which was already fetched only when it is asked for.
- The levers the panel pulls stand in for the world, which was Adam's word of 2026-10-01: a production build
  cannot add a key figure, offer a dialogue or give vision until the world does those things itself. That is
  the point, and it is also why a production build is not yet something to play.
- Adding to the panel adds nothing to a player's build. A section that wants a word from the game still imports
  it; the game never imports a section.
- The build badge goes with the panel, which is the only place it is shown; its few lines of stylesheet stay in
  the page's, unused, until the version is shown somewhere a player can see it.
- Serving a production build to prove this - the first time one was served - found an older fault of its own:
  MapLibre's worker is not in the build, so the map never finishes loading and nothing stands on it, though the
  terrain draws. It was so before this decision and is left to a step of its own.

## Alternatives considered

- **A setting that hides the panel.** The code and the words would still ship, and a player could turn it back
  on. The point is that it is not there.
- **`React.lazy` around the panel, with no guard.** It keeps the panel out of the first chunk and still emits it
  as a chunk of its own, served to anyone who asks for it. Behind the guard, `lazy` and an import at the entry
  come to the same thing; the entry is where the stage's arrangement is decided as well, so it is decided there,
  once.
