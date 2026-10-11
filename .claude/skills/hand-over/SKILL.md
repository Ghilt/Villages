---
name: hand-over
description: Bring a finished step back to Adam for review - regenerate what it made stale, leave the program running on the change, and present it ending with the address and a numbered verify checklist. Use at the end of every step, before anything is committed, and whenever the loop comes back to Adam to look at something. Adam can also type /hand-over.
---

# Hand-over

A step is not finished when the work is. It is finished when Adam can see it: the program running in this
tree, standing on the change, and a presentation he can read top to bottom and answer by a number. He
verifies through the running program and the debug panel, not through code (decision record 0023), so
whatever the step makes the program do must show there. He should never be handed a change whose evidence
he has to generate himself.

## 1. Verify it

Run the checks the step touches - `npm run check --prefix frontend`, `cd backend` then `./gradlew check` -
and for anything visible, look at it in the browser pane and say what you saw. Report what failed,
including the things you had to fix on the way.

## 2. Regenerate whatever it made stale

If the step changed the master, the palette, the render colours, a style file, `world/biomes.json`, the
names, or any code the paint or the tiles go through, do the regeneration now, without asking and without
offering it as an option: that is the `regenerate-world` skill. Stale output is worse than missing output,
because it looks like evidence.

## 3. Leave the program running on the change

- **Start it with the quick-start**, from the worktree root, its output to a file rather than a pipe (the
  servers hold a pipe open and the call never returns):

      powershell -File debug-quick-start.ps1 -NoBrowser > .logs/quick-start.txt 2>&1

  Not the `web` entry of `.claude/launch.json`: the desktop app stops a server it started that way once
  the session goes quiet, and Adam finds nothing at the address. The quick-start's servers are detached and
  outlive the session, and it replaces a server older than the code it serves, so it is also the restart
  after a protocol change.
- **Start it in this tree.** Every worktree serves on its own ports; `node frontend/apps/web/vite/worktreePort.ts`
  prints this one's. If a port is taken anyway, do not stop what holds it - it is another session's. Say so.
- **Drive it to where the change shows**: the right renderer, master, part of the world and zoom, the right
  pane open. Not whatever it opened with.
- **Copy the debug panel** into the presentation when the change is one the panel reports.
- **The browser pane stops animation frames when it is hidden**, and MapLibre waits on one for its style
  to load and for every `flyTo`. A hidden pane shows a map that never finishes loading and a camera that
  says it is moving while standing still; neither is a bug. A screenshot pumps one frame, so a handful in a
  row carries a flight to its end. The DOM, the panel and the log can be read without any of that.

Where the change genuinely cannot be seen in the running program - the offline renderer, a build rule, a
document - say so plainly, and say what stands in for it: a test, a still, or a number.

## 4. Present it, in this order, and stop

1. **What changed and why**, in plain words: name both ends of anything that is "sent", say what a thing
   does before naming its term, if at all.
2. **The files.**
3. **The check output**, failures included.
4. **The documents touched** - a change to a decision, an event or a term updates its document in the same
   commit - or, if a thing fit no document, say that a new one is needed.
5. **What was regenerated and what moved**, with a number and a picture, when step 2 ran.
6. **Where to look**, one line and nothing else on it - either the running program:

       http://localhost:5548 · worktree <folder under .claude/worktrees/>, branch <git branch --show-current>

   or links to the documents, when what there is to verify is something to read. The folder and the branch
   can differ, and the app does not always show which tree a session is in, so this line is what lets Adam
   find the tree and start it himself.
7. **The verify checklist**, last, with nothing after it.

No commit message and no plan of commits: how the work is cut into commits is the agent's, and Adam does
not want to think about it. Do not commit yet. His answer decides what happens next:

- **"continue"**, or **"cont"**, with no notes: commit what he verified, as many commits as best practice cuts it into,
  say in a line what landed, and go on. If that was the last step of the plan, say so plainly and bring the
  work to main - its implicit last step - with the `to-main` skill.
- **Notes**: fix them and hand over again. Nothing is committed.
- **"main"**, or "bring it to main": he has verified it. The `to-main` skill: commit what is waiting, ask
  about the architecture diagram if something significant was added, bring it all to main, and offer the
  next steps. Main moves on his word and only then.

## The verify checklist

- **Three items at most**, whatever the size of the step. It refreshes a memory; it does not enumerate a
  diff. Pick them for what would be embarrassing to have got wrong.
- **Numbered `1.` `2.` `3.`**, never checkboxes, so Adam can answer one by its number. A question put to
  him is an item like any other, phrased so it can be answered from the item alone.
- **👀 on every item he can check by looking at the running program**, saying where - which pane, which
  button, what should be there. **Those go first.** An unmarked item is one he takes on trust, reads in a
  document, or accepts from a test.
- **Where is what Adam sees at the address, in his own browser**, never "the browser pane": that is the
  agent's own tool, and in it the agent is another player. What the agent made as that player is on his map
  only with the fog lifted, or once he makes it again with a lever; say which, and how.
- **A place on the map is a link that opens the game there**, `http://localhost:<port>/?at=<lat>,<lon>&zoom=<z>`,
  with what he will find there in plain words. Never a geographic name he is assumed to know: "the Sahel line"
  meant nothing to him (2026-10-11).
- **A step with nothing to look at says so.** Three honest unmarked items beat one 👀 invented to fill the
  quota.

## Change this skill

This file is how a hand-over is done, and Adam owns it: when he corrects a hand-over, the correction goes
here, in the same step, rather than into memory.
