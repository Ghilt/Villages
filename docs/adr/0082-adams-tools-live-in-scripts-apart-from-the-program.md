# 0082. Adam's tools live in scripts/, apart from the program

- Status: accepted
- Date: 2026-10-03

## Context

The first tool Adam asked for to change a master by hand, the one that mends broken rivers, was built in the
world package as `world:mend-rivers`, beside the tools the program's world pipeline runs. It got there for
convenience: the package already had a PNG reader and writer, and its tests ran with the frontend's checks.

That was the wrong home. A tool Adam runs from a terminal to change a file is not part of the program, and
inside a workspace it has to be run through npm with `--prefix frontend`, depends on the frontend's packages
being installed, and is found only by someone who already knows it is there. Adam asked for a suite of such
tools, kept apart from the program in one folder he can open in a terminal, where running a tool with no
arguments tells him how to run it.

## Decision

**Adam's tools are in `scripts/`**, one file a tool at the top of the folder, run as `node <tool>.ts` from
there. Given nothing or `--help`, a tool prints its help and stops. `scripts/README.md` lists the tools and
says how one is added.

**They import nothing of the program and need nothing installed.** Node 24 runs the TypeScript as it is, and
the tools use only Node's own modules. What they share is in `scripts/lib/`: a PNG reader and writer of their
own, and a master read as one class a pixel. The repository's data files - `world/palette.json`, the masters -
are read as data, which is what they are to the program too.

**They are tested with Node's own runner**, `node --test` in that folder, and type-checked with the frontend's
compiler pointed at `scripts/tsconfig.json`. That borrows a compiler, not a dependency: the tools run without
it. Nothing runs these checks automatically yet; the agent that changes a tool runs them, as it runs the
frontend's.

The program keeps one thing from the move: `masterNameOf` refuses a `_audit_` picture, because the rule about
which files in `world/master` are worlds belongs to the program, whoever writes the files.

## Consequences

A tool works on any checkout, whatever state its frontend is in, and Adam can find every tool by listing one
folder. The cost is a second, smaller PNG codec beside the world package's, and checks that are separate from
`npm run check`, so they can go stale if nobody runs them.

`scripts/` was already named in `CLAUDE.md` as where `check.ps1` and `check.sh` will go with increment 0.14.
They sit there well enough: they are terminal tools Adam runs too.

## Alternatives considered

- **Keep tools in the world package and add help.** It keeps one PNG codec, but keeps the npm prefix, the
  install and the coupling to the program's build, which are what Adam objected to.
- **PowerShell or Python.** PowerShell would suit the machine but makes a 32768 by 16384 image painfully slow,
  and Python is on this machine but is not a prerequisite of the project. Node 24 already is.
