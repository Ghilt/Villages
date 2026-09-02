# 0012. Local git, no continuous integration yet

- Status: accepted
- Date: 2026-09-01

## Context

One developer, one machine, no remote, and no deployment. Every test level runs locally in a couple of commands.

## Decision

A local repository on the main branch, and one check script that runs every test level. A remote and continuous
integration arrive when there is a second contributor, a deployment, or something worth protecting.

## Consequences

Nothing to configure and no pipeline to wait for. The check script is exactly the command a future pipeline will run,
so adding one later is a small change rather than a redesign. There is no copy of the history off this machine, which
is a real risk accepted knowingly: a remote is cheap to add the day it matters, and this record should be revisited
the first time the history would be hard to recreate.

## Alternatives considered

- A hosted remote with a pipeline from day one: a remote to configure and a pipeline to maintain, for a single
  developer who runs the same checks locally in less time.
- A hosted mirror with no pipeline: backup without the ceremony. Worth doing as soon as the history is valuable.
