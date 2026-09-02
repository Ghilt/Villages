# 0010. The document system

- Status: accepted
- Date: 2026-09-01

## Context

The design will be discovered over many sessions, with long gaps and no shared memory between them. Neither the code
nor a conversation log records why something is the way it is, and an experimental project generates more discarded
reasoning than a conventional one.

## Decision

Nine documents with distinct jobs: the working notes for how we work, the vision for what the experience is, the
glossary for the shared language, the architecture for structure, numbered decision records for decisions, an
experiment journal for hypotheses and their outcomes, a roadmap for what is next, an event catalogue for the durable
contract, and a testing guide. Documents travel with code: a change to a decision, an event or a term updates its
document in the same commit.

## Consequences

A session can be resumed by reading the roadmap and the recent decision records. Decision records are immutable once
accepted, and are superseded rather than edited, so the reasoning of the past stays legible even where it was wrong.
The event catalogue is parsed by a test, so the one document that must never drift cannot. This is more writing per
change, deliberately, and the documents are short for that reason.

## Alternatives considered

- One design document: goes stale, becomes unreadable, and loses the reasoning behind superseded choices.
- Comments in the code: cannot hold a decision, its consequences, or the alternative that was rejected.
- An external wiki: drifts from the code, and does not appear in the diff being reviewed.
