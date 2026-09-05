# Glossary

The shared vocabulary of Villages. These words are used verbatim in code, in event names and in the interface. If a
term changes here, it changes in all three places in the same commit. Names in `code font` are identifiers that exist
in the source.

| Term | Meaning |
|---|---|
| **Aggregate** | A consistency boundary with its own event stream. `House` is the only one so far. |
| **Banner** | A house's heraldic device: a field of one or two tinctures, a division, and a charge. The visible identity of a house, shown in the interface and as its sprite on the map. `Banner` |
| **Cell** | A square of the world used to partition live updates and map queries: a quadkey at any zoom from 0 to 10, so a cell's ancestor is its prefix. Derived from a place wherever it is needed, never carried on an event. See decision record 0026. `Cell` |
| **Charge** | The figure borne on a banner, such as a tower, a stag or a star. `Charge` |
| **Chrono-engine** | The part of the game that rolls what can happen to a house at a moment in world-time, and that owns the pins which keep the world's history from contradicting itself. Described in `SETTING.md`; not yet in the source. |
| **Command** | A request to change the world, named as an imperative: `FoundHouse`. It may be rejected. Commands are not stored. |
| **Decider** | The pure pair of functions that make up an aggregate: decide turns a command and the current state into events, evolve folds an event into the state. It holds the rules of the game and depends on nothing. `HouseDecider` |
| **Delta** | An incremental change pushed to a client after its snapshot: a house appeared, or a house changed. |
| **Division** | How the field of a banner is partitioned: plain, per pale, per fess, quarterly. `Division` |
| **Event** | Something that happened, named in the past tense: `HouseFounded`. Events are the only durable state and are never edited or deleted. |
| **Event store** | The append-only record of every event, one stream per aggregate. MongoDB, through Occurrent. |
| **Frame** | One message on the wire between the gateway and the browser: JSON text with a `type` field naming it. The fixtures in `contracts/fixtures/frames` own the format, and both ends are tested against them. `ClientFrame`, `ServerFrame` |
| **Gateway** | The service that holds player connections, serves snapshots and pushes deltas. Stateless apart from its live connections. |
| **House** | The thing a player plays: a noble lineage with a name, a banner, a seat and a treasury. One event stream each. `House` |
| **House-spirit** | The character a house has earned through everything it has done, as traits and effects that colour its rolls. It lives in player-time, so it is the same whichever century is being played. Not yet in the source. |
| **Influence zone** | A geographic area a house has some kind of reach over, drawn on the map as a fence. Owned or controlled territory is the common kind. Not yet in the source. |
| **Key figure** | One of the few named members of a house the player acts through. A house has uncounted members behind them, so losing every key figure is a low power state, never a loss. Not yet in the source. |
| **Pin** | A fact the chrono-engine has committed the world to at a world-time - a cathedral exists here in 1247 - which obliges the past or the future to make it true. Shown on the timeline as something cloudy that fades. Not yet in the source. |
| **Player** | The human. Identified for now by an anonymous token generated in the browser. `PlayerId` |
| **Player-time** | The order things were actually done in at a keyboard: the event store's own order. What the house-spirit and arbitration between players run on. Distinct from world-time. On every event as `recordedAt`, the server's instant. |
| **Projection** | A read model built by folding events, kept in MongoDB and queried by the interface. The event store is never queried to draw the map. |
| **Rate** | A resource expressed as an amount, a rate per second, and the instant at which that was true. Clients interpolate between updates, so the world needs no tick events. |
| **Seat** | Where a house is founded: its place on the map, and the anchor of its sprite. `Location` |
| **Significance** | How much a thing matters to the world, from nothing to a hundred, carried on the event that made it and deciding how far out on the map it stays drawn. A hundred is drawn from the whole world. `Significance`, and `coarsestZoom` turns it into a zoom |
| **Snapshot** | The current contents of a cell, sent when a client subscribes to it, before any deltas. |
| **Stream** | The ordered events of one aggregate instance, addressed as `house:<uuid>`. |
| **Tincture** | A heraldic colour. Metals are or and argent; colours are gules, azure, sable, vert and purpure. A charge of a metal goes on a field of a colour, and the reverse. `Tincture` |
| **Treasury** | The stored wealth of a house, expressed as a rate. The first resource in the world. `Treasury` |
| **Warp** | The pure transformation that turns a place on Earth into a place in our world: control points that drag their surroundings, a seeded wobble, and optionally a turn of the globe. Applied once, at build time, and configured by `world/warp.json`. |
| **World** | The single shared place every player is on: a warped Earth, generated by us and canonical. Its coordinates are longitude and latitude, and they are not Earth's. There are no shards. |
| **World-time** | The story's clock: a day in the world's calendar, which spans centuries, counted from the first day of year one. What the chronicle, the map at a moment, the timeline scrubber and pins run on. Distinct from player-time. `WorldTime`; on every event as `worldTime`, and read as a year and a day by `Calendar` |
