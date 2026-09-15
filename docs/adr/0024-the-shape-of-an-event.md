# 0024. The shape of an event, in the store and on the wire

- Status: accepted
- Date: 2026-09-04

## Context

Events are the only durable state, so their shape is a contract with every future version of the code and
with every consumer: the projections, the broker, the browser, and the debug panel that decision 0023 says
must show them. Increment 1.5 is the first code that writes one, so the shape has to be decided now, and
decided as a whole rather than by whatever Jackson happens to do.

Adam asked for this to be rigorous, and for no event beyond HouseFounded to be assumed. So this record
fixes the envelope and the encoding for every event, and says nothing about which events will exist. That
list is docs/EVENTS.md, one row at a time, each a decision.

## Decision

Extended by decision record 0035, which adds two attributes to the envelope: the story an event
belongs to and what caused it.

**An event is a CloudEvent**, version 1.0, as Occurrent stores it. Of its attributes we set:

| attribute | value | why |
|---|---|---|
| `id` | a fresh UUID | unique across the world, so a consumer can deduplicate |
| `source` | `urn:villages` | one world, one source; there are no shards |
| `type` | `villages.<aggregate>.<verb>.v<n>` | the catalogue's naming; the class of the event is not on the wire |
| `subject` | the aggregate's id, `6d5b…` | so a consumer can route or filter without opening the data |
| `time` | the instant in the event, `at` | when it happened by the server's clock, not when it was stored |
| `datacontenttype` | `application/json` | |

Occurrent adds `streamid` (`house:<uuid>`) and `streamversion` (from one, per stream) as extensions, and
those two are what order events and address them.

**The data is the event's Kotlin fields, encoded by these rules**, so the store never depends on a default:

- Value classes are unwrapped: a `HouseId` is the UUID as text, a `HouseName` the text, a `Cell` its quadkey.
- Instants are ISO-8601 text in UTC, `2026-09-04T12:00:00Z`, never a number.
- Enums are their declared names, `SABLE`. The wire's spelling for the interface, `sable`, is the
  protocol's business and the gateway translates; the store says what the code says.
- Every field is written, nulls included, so the shape of a type is constant and a reader can tell a
  field that is null from a field that did not exist yet.
- Field names are the Kotlin names. Renaming a field is a new version of the event.
- Identifiers are text. Amounts are integers. Rates are numbers.

**Each catalogued type is pinned to a fixture**, `contracts/fixtures/events/<type>.json`, holding one
CloudEvent exactly as stored. A test writes a known event and compares it to the fixture, then reads the
fixture back as the event. That is what makes the shape a contract rather than a habit: any drift shows
in the diff of a checked-in file, in the same commit that caused it.

**On the wire to the browser**, an event travels in the `event` frame, generic across all types: the
envelope fields flattened, `time` in server milliseconds like every other time in the protocol, and
`data` as it is stored, untranslated. The debug panel shows the envelope as a line and opens the data.

## What this does not decide

Which events exist. The catalogue has one row. Questions that are open and are Adam's to answer, each
of which becomes a row when it is answered:

- Does a house have events of its own beyond founding, and what is the second one?
- Do resources emit an event on every change of rate, as the rate model implies, or only on some?
- Is the player an aggregate with events, or only a subject on the house's?
- What happens to a house nobody plays: is there an event for that, or is absence enough?
- When two houses first act on each other, whose stream does the event belong to?

## Consequences

The debug panel can show any event the world will ever have without changing, because the frame is
generic and the data is whatever was stored. A new event needs a class, a table row in `HouseEventTypes`,
a catalogue row, and a fixture; four tests fail until all four exist, which is the point.

Reading an old event needs the old class to still exist, or an upcaster in the converter. The pre-alpha
wipe policy of decision 0011 holds until the world-persistence milestone.

## Alternatives considered

- **Class names as CloudEvent types**, Occurrent's default. Ties the store to the code's package layout,
  and a rename would silently break every stored event.
- **Instants as epoch numbers in the store.** Compact, and unreadable in a panel or a database shell.
- **Omitting nulls.** Smaller, and a reader can no longer tell "not set" from "did not exist in v1".
- **The interface's spelling in the store.** The store would then depend on how the browser shows things.
