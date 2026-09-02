# Event catalogue

Every domain event in the world. Events are the only durable state: they are never edited and never deleted, so this
catalogue is the contract between the past and every future version of the code.

This file is parsed by a test. From increment 1.5, the event type catalogue test reads the tables below and fails if
the code and the catalogue disagree in either direction. Keep the format exactly as described:

- One section headed with the aggregate name per aggregate, and inside it exactly one table.
- Columns, in order: Type, Payload, Meaning, Produced by, Consumers.
- The Type cell holds the CloudEvent type in backticks and nothing else.
- The Payload cell lists field names in backticks, separated by commas.
- Rows are ordered by version, then alphabetically.

## Naming and versioning

- A type reads as villages, then the aggregate, then the event in the past tense, then the version. The first one is
  going to be `villages.house.founded.v1`.
- Adding an optional field keeps the version.
- Any other change creates the next version. The old type stays in this catalogue forever, and stays handled when
  folding a stream.
- Pre-alpha exception, in force until the world-persistence milestone in the roadmap: the event store may be wiped
  rather than migrated. Every wipe is recorded in the experiment journal. See decision record 0011.

## House

One stream per house, addressed as house followed by its identifier.

| Type | Payload | Meaning | Produced by | Consumers |
|---|---|---|---|---|
| _none yet; the first arrives in increment 1.2_ | | | | |
