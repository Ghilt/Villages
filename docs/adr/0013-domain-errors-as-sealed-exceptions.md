# 0013. Domain errors are sealed exceptions thrown from decide

- Status: accepted
- Date: 2026-09-01

## Context

Deciding a command has to be able to reject it. The decider signature in Occurrent returns a list of events, and an
Arrow-flavoured variant of the module exists for expressing failure as a value instead.

## Decision

A sealed exception hierarchy in the domain, thrown from decide. No result type in the signature, and no additional
dependency.

## Consequences

Decide keeps exactly the shape the application service expects, so there is no wrapping or unwrapping at the
boundary, and a test reads as an assertion that a specific error was thrown. Exhaustiveness moves from the compiler
to the catch site, which is the cost: one place in the gateway maps a domain error onto a rejection frame, and that
mapping is tested. If command validation grows into many recoverable branches that callers must handle individually,
a result type or the Arrow variant becomes right, and this record is superseded rather than edited.

## Alternatives considered

- A result type returned from decide: explicit and exhaustive, and it wraps every call site and diverges from the
  shape of the library, for a domain with very few failure modes today.
- The Arrow decider module: a dependency and an idiom to adopt for a problem we do not have yet.
- Emitting a rejection event: writes noise into a stream that is meant to be the history of what actually happened.
