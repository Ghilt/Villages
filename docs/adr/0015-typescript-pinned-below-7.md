# 0015. TypeScript is pinned below 7 so that the linter can read our code

- Status: accepted
- Date: 2026-09-02

## Context

TypeScript 7, the native rewrite of the compiler, is the current release. The linter cannot use it yet:
typescript-eslint 8.69 declares support for TypeScript below 6.1, and nothing newer exists. Without
typescript-eslint there is no parser for TypeScript files at all, so ESLint could not read a single source file
in this project, and the boundary rule that keeps the client core free of the interface would be unenforceable.

## Decision

Pin TypeScript to 6.0.x. Revisit as soon as typescript-eslint supports 7, and upgrade in one commit that runs the
whole check.

## Consequences

We give up whatever the new compiler is faster at, on a code base small enough that compilation is not a cost yet,
and we keep both halves of the boundary enforcement: the compiler rejects DOM use in the core, and the linter
rejects forbidden imports. The pin is a caret range on 6.0, so patch and minor updates still arrive. This is the
kind of record that expires: when it does, supersede it rather than editing it.

## Alternatives considered

- TypeScript 7 with the linter forced past its peer range: the parser would be fed a compiler it does not
  understand, and lint failures would be indistinguishable from real ones.
- TypeScript 7 with no linting of TypeScript: loses the import boundary, and the compiler alone does not enforce
  which package may depend on which.
- TypeScript 5.9: also supported, and needlessly older than what the linter allows.
