# 0037. The wire has a version, and the version has a recording

- Status: accepted
- Date: 2026-09-16

## Context

Adam opened the game and found this in the debug log, over and over:

```
gateway  error unreadable: not a frame this gateway speaks: Could not resolve type id 'wipeWorld'
         as a subtype of `villages.protocol.ClientFrame`: known type ids = [command, hello, ping,
         subscribeCells, unsubscribeCells, viewTime, watchEvents]
```

and no parchment when he pressed restart. Nothing was wrong with the code. The gateway answering him
was a Java process started on 10 September and still listening on 8080 six days later, from a session
that had long since ended. The page was today's; the server was last week's.

Two things let that happen, and each is worth fixing on its own.

**The handshake already refuses a version it cannot speak.** `Hello` carries `protocolVersion`, and
`Gateway` answers a mismatch with "this gateway speaks version N". That mechanism was built for exactly
this and did nothing, because `PROTOCOL_VERSION` had been 1 since the day it was written. The first
gameplay loop added `takeAction`, `yourChoice`, `wipeWorld` and `worldWiped`, and put two new fields on
`event`, and the number did not move. A version nobody remembers to change is not a version; it is a
constant that looks like one.

**The launcher adopts whatever answers.** `debug-quick-start.ps1` tests the port, finds something
listening and says "the game server is already up on 8080, leaving it alone", which was true and
useless. It had no opinion about *what* was up.

The fixtures in `contracts/fixtures/frames` did not catch it either, and could not have: a fixture
proves that a frame both ends know about is written the way both ends expect. Nothing held the *set* of
frames to anything.

## Decision

**The shape of the wire is recorded, one file per version, and the code must match the recording for
the version it declares.** `contracts/protocol-v2.txt` lists every frame that may cross the socket and
the fields it carries, one line each:

```
version 2

client wipeWorld
command takeAction choiceId optionId
server event causationId correlationId data eventType id stream streamVersion time
```

Names and fields, not types. What a field holds is the fixtures' business and they own the format; what
exists at all is this file's, and that is the half a stale server gets wrong.

**Both ends check themselves against the same file.** `ProtocolShapeSpec` reads the shape off the sealed
Kotlin hierarchies and their `@JsonSubTypes`; `protocol.shape.test.ts` reads it off the zod discriminated
unions. Neither can be satisfied by editing the other end.

**That file is also what pins the two `PROTOCOL_VERSION` constants to each other.** Each end opens
`contracts/protocol-v<its own number>.txt`. Declare 2 in Kotlin and 1 in TypeScript and the TypeScript
test reads the v1 recording, whose shape it no longer has. The constants cannot drift apart silently,
which they previously could.

**Changing a frame or a field means a new version and a new recording.** The old recordings stay where
they are. `contracts/protocol-v*.txt` is therefore the history of the wire, readable in one directory,
and re-recording over a version that has already been spoken is not the way out of a red build: it is
how a server and a page come to disagree while both believe they agree. The failing test says all of
this, because the moment it fires is the moment someone needs to know it.

Recording is deliberate and takes a switch:

```
cd backend && ./gradlew :protocol:test -Dprotocol.record=true
```

**The launcher looks at what holds the port instead of trusting it.** If the process listening on 8080
started before the newest `.kt` under any `backend/*/src`, it cannot be running this tree's code;
`debug-quick-start.ps1` says so, says how old it is in days, and says what to do about it, rather than
reporting it green. It does not kill it: 8080 is shared by every worktree on this machine and a process
there may be another session's, which CLAUDE.md is explicit about. *(Superseded the same day by the
amendment below: it takes the port now, and 8080 is no longer shared.)*

### Amended 2026-09-16: the tree you launch from owns its ports

Saying so was not enough. Adam's answer, on being shown the warning: *"the important thing is that i
should feel like if i wanna see whats on main, i wanna be able to click that thing, and then my main
should run the latest stuff."* That is the right standard, and a warning does not meet it.

**A port held by something that is not this checkout's current server is taken.** Another tree's server,
or one started before the code it serves was written, is stopped and replaced. Running this from a
checkout means "show me this checkout", and anything else answering was already in the wrong place. The
alternative below, declined this morning on the grounds that 8080 belongs to everybody, is overtaken by
the amendment to decision 0031: 8080 belongs to the main checkout now, and every worktree has a game
port of its own, so taking a port back can no longer take anyone else's world with it.

**The window stays open and `q` stops both servers.** Double-clicked, `debug-quick-start.cmd` used to
print an address and wait for a keypress to close, leaving two servers running with nothing left to
press. It passes `-Hold` now: the window is the servers while it is open, `q` ends them, `l` shows the
tail of both logs, and closing it leaves them running, which is what you want when you are done with the
terminal and not with the game.

**It lists every Villages server on the machine**, whichever checkout started it, with the tree it
belongs to and how long it has been up. That listing is what would have shown the six-day-old server in
one line, and it is a page of the same argument: knowing beats assuming.

**And the page says which build it is**, bottom right, in the smallest type on the screen: the branch,
the short commit with a `+` when there are tracked changes, and the version of the wire. Asked of git on
every load rather than baked in at startup, because a dev server outlives a merge. A built page with no
dev server to ask still says what it speaks.

## Consequences

The version is now a thing that moves, so a stale server is refused at the handshake with "this gateway
speaks version 1" instead of producing Jackson's opinion of an unknown type id after the fact. The error
names the fault.

Every protocol change grows a file. At one version per meaningful change that is a few files a year,
each about thirty lines, and their value is that a future argument about when a frame appeared is
settled by reading rather than by `git log`.

Two tests now fail on any wire change, which is the point, and both fail with instructions rather than a
diff. The cost is one extra step in a frame-adding increment, and it is on the `docs/MECHANICS.md`
checklist so it is not remembered but read.

The launcher's staleness check compares clocks, so it is fooled by a tree checked out fresh (every file
newer than any running server, which warns correctly but for the wrong reason) and by a server started
from a different worktree that happens to be up to date. Both err toward saying something, which is the
right direction for a thing whose failure mode was silence.

This does not make the development server survive anything. Everything is still in memory and a restart
still forgets the world, by decision 0011.

## Alternatives considered

- **Derive the version from a hash of the shape**, so it can never be forgotten. It would also change on
  every whitespace-level refactor of the frame classes, and a version that changes by itself is one
  nobody can reason about. A number a person chooses, with a test that insists they choose one, keeps
  the meaning.
- **Have the launcher stop a stale server automatically.** Tempting, and it is one line, given `Stop-Port`
  already exists for `-Stop`. Declined in the morning: the game port was 8080 for every worktree, so the
  process there might belong to another session, and CLAUDE.md says do not stop it. **Taken in the
  afternoon**, once Adam said what he actually wanted from a double click, and once the game port stopped
  being shared. The objection was real and the answer was to remove what made it real, not to live with
  the warning. See the amendment above.
- **Have the server announce its build in `Welcome`**, and let the browser compare. Useful later, and it
  would catch a mismatch the version number misses because someone forgot to bump it; but it needs a build
  stamp the build does not currently produce, and it treats the symptom rather than the rule.
- **Nothing, and rely on remembering.** That is what was in place, and it is what produced the log above.
