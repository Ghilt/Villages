# 0016. Adam chooses the next step, from options

- Status: accepted
- Date: 2026-09-02

## Context

Decision record 0009 put a human in front of every commit, and that worked: nothing lands unreviewed. It left a
gap on the other side of the commit. Having approved a change, Adam was handed the next one already in progress,
chosen from the plan by the agent. In a project whose whole premise is that the design will be discovered by
experiment, the choice of what to try next is the most consequential decision anyone makes, and it was the one
decision being made unilaterally.

## Decision

After every commit, the agent stops and offers two to four concrete options for what comes next, each with what
it would produce and what it would cost, plus a recommendation and the reason for it. Adam picks one, changes one,
or says something else entirely. The agent never selects the next increment on its own and never chains
increments together to save a round trip.

The roadmap is explicitly a menu rather than a queue. Its order is a suggestion, and an option that is not on it
should still be offered when it is the better idea.

## Consequences

Direction changes cost one sentence instead of a discarded increment, and the plan stays a plan rather than
becoming a commitment. Adam sees the decision space, including the options he would not have thought to ask for,
which is the part an agent is actually useful for. It costs a second stop per increment on top of the review stop,
so an increment now spans two exchanges. That is the price of steering, and it is cheap next to building the
wrong thing well.

## Alternatives considered

- Follow the plan and report progress: fastest while the plan is right, and it hides every moment where the plan
  stopped being right.
- Offer options only at phase boundaries: fewer interruptions, and the phases are long enough that a wrong turn
  would run for days.
- Ask an open question instead of offering options: maximum freedom, and it puts the burden of recalling the
  whole decision space on the person with the least context loaded.
