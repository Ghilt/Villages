# 0031. A worktree serves on its own port, worked out from its name

- Status: accepted
- Date: 2026-09-09

## Context

Decision 0020 made sessions declare what they are touching, because work happens in several worktrees at
once. Everything else about running the program still assumed one of them.

`vite.config.ts` asked for port 5173 with `strictPort`, so the first tree to start served and every other
tree's dev server refused to come up. Today that was not hypothetical: eight worktrees existed, one had
5173, and this session could not look at its own change in a browser at all. It verified against another
session's server after checking that the paint code in the two trees was byte-identical, which happened
to be true and is not a thing to rely on.

The pin was there for a good reason. `debug-quick-start.ps1` prints one address, every document says
5173, and Adam knows it by heart. Dropping `strictPort` gives that up for a port that moves between runs,
and it is worse than it sounds: with several trees serving, a bookmark quietly opening a different branch
of the world is a mistake that looks exactly like a bug in the change you are reviewing.

`.claude/launch.json` had the same disease more quietly. It is committed, and it named
`E:\Code\Villages\backend\gradlew.bat` outright, so in any worktree the preview tooling started the main
checkout's game server. Nobody had noticed because nobody had run it from a worktree.

## Decision

**A worktree's port is a hash of its directory name.** The main checkout keeps 5173.

- `portFor` in `frontend/apps/web/vite/worktreePort.ts` is the rule: FNV-1a over the name, avalanched,
  into the 500 ports above 5173. The same tree gets the same port every time it starts, so the address
  can be bookmarked, put in a session file, or told to somebody, which is the whole property that taking
  the first free port would lose.
- **`strictPort` stays, and now it can afford to.** The port belongs to one tree, so a clash means either
  that tree is already served or two names hashed together. Both are worth being told about. Neither is
  worth drifting onto a port somebody has bookmarked for something else.
- **Nothing is written down per tree.** Worktrees are short-lived and are made and deleted constantly, so
  there is no registry and no file to clean up when one disappears. The name is the whole input and
  `git worktree list` is the whole source of truth.
- **`.claude/launch.json` is generated and no longer committed**, by
  `node frontend/apps/web/vite/worktreePort.ts --launch`, which `debug-quick-start.ps1` runs. Every field
  in it is per-checkout, so it cannot be one file in git - the same reasoning that keeps `.sessions/` out
  of git in 0020.
- **The gateway lets a page in from any localhost port.** `WebSocketConfig` allowed exactly one origin,
  `http://localhost:5173`, so a page served from a worktree was refused with 403 while the server was
  plainly up, and the debug panel said `closed`. It now allows the pattern `http://localhost:[*]`: any port
  on this machine and nothing further, because `*` would let any site a browser here visits open a socket to
  a local game server. `GatewayOriginTest` holds the rule from both sides, a worktree's port let in and a
  foreign origin refused.
- **The dev server says which trees exist and which are up**, at `/dev-api/worktrees`, and the app draws
  a strip of tabs across the top: the one you are on marked, the ones serving as links, the rest dim.
  Development only, and absent entirely when there is one tree.

### Amended 2026-09-16: and its own game port

The port per tree was only ever half of it. The game server stayed on 8080 for every checkout, so one
tree could run a backend and the rest either sat blind or - worse, and quietly - talked to whichever
tree happened to own the port. A page built on one branch putting its events into another branch's
store is not a thing you notice; it looks like the program working.

**A tree's game server sits three thousand above its dev server**: 5548 serves the page and 8548 serves
the world, and knowing either gives the other. The main checkout keeps 5173 and 8080, which are in every
document and in Adam's muscle memory. `worktreePort.ts --game` prints it, `--launch` writes it into
`.claude/launch.json` as both the port and `--server.port`, and the dev server hands it to the page as
`VITE_GAME_PORT`, so a page connects to its own tree's world without anybody setting anything.

What forced it was decision 0037's amendment: once the launcher takes a port it finds in the wrong
hands, a game port shared by thirteen checkouts stops being a nuisance and becomes a fight.

## Consequences

Several sessions can serve at once, so a change can be looked at in the tree it was made in. That is what
the working agreement now asks for at every step, and until today it was not always possible.

The page says which branch of the world it is. That was the quieter problem: two worktrees look identical
on the screen, and the way you found out you had been judging the wrong one was by noticing your change
was missing.

A hash collides. Five hundred ports and the eight or nine trees that are usually alive give roughly a one
in a hundred chance that two want the same port, and then the second to start fails loudly and says so.
The fix is to rename or delete a worktree, which costs nothing because they are short-lived. This is why
the avalanche step in `portFor` is not decoration: without it a thousand names of the shape these have -
a slug and a hex suffix - used only 307 of the 500 ports rather than the 432 a fair hash gives, because
FNV ends on a multiply and a remainder reads exactly the low bits a multiply does not mix.

The probe behind the tabs asks both loopback families, because Vite binds to whatever `localhost` means
and here that is IPv6. Asking 127.0.0.1 alone reported every server down, including the one answering the
page. `debug-quick-start.ps1` avoids the same trap by reading the port table and says so in a comment.

What the probe reports is that something is listening on a tree's port, not that it is that tree's server.
Nothing else uses this range, so it is right in practice, and it is honestly wrong for a while after this
lands: a session still running the old code sits on 5173 and shows up as `main`.

## Alternatives considered

- **First free port from 5173 up.** Simplest, and it gives up the fixed address: the tab bar becomes the
  only way to find your own server, which makes a navigation aid load-bearing.
- **Assign ports by position in `git worktree list`.** Deterministic given the set of trees, and the set
  churns hourly, so every tree's port would move whenever a sibling appeared or went away.
- **A port written into a file in each worktree.** Survives renames, and it is state to create, read and
  clean up for something a hash gives for free, in trees whose whole life is a few hours.
- **Keep one port and take turns.** What we had. It is fine with one session and this project stopped
  having one session some weeks ago.
- **Keep `launch.json` committed and let it be wrong in worktrees.** It was already wrong, pointing every
  worktree's game server at the main checkout.
