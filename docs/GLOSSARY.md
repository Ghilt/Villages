# Glossary

The shared vocabulary of Villages. These words are used verbatim in code, in event names and in the interface. If a
term changes here, it changes in all three places in the same commit. Names in `code font` are identifiers that exist
in the source.

| Term | Meaning |
|---|---|
| **Aggregate** | A consistency boundary with its own event stream. `House` is the only one so far. |
| **Banner** | A house's heraldic device: a field of one or two tinctures, a division, and a charge. The visible identity of a house, shown in the interface and as its sprite on the map. `Banner` |
| **Cell** | A fixed square of the world used to partition live updates and map queries. A quadkey at zoom 8. Carried on events so that nothing downstream has to recompute it. `Cell` |
| **Charge** | The figure borne on a banner, such as a tower, a stag or a star. `Charge` |
| **Command** | A request to change the world, named as an imperative: `FoundHouse`. It may be rejected. Commands are not stored. |
| **Decider** | The pure pair of functions that make up an aggregate: decide turns a command and the current state into events, evolve folds an event into the state. It holds the rules of the game and depends on nothing. `HouseDecider` |
| **Delta** | An incremental change pushed to a client after its snapshot: a house appeared, or a house changed. |
| **Division** | How the field of a banner is partitioned: plain, per pale, per fess, quarterly. `Division` |
| **Event** | Something that happened, named in the past tense: `HouseFounded`. Events are the only durable state and are never edited or deleted. |
| **Event store** | The append-only record of every event, one stream per aggregate. MongoDB, through Occurrent. |
| **Gateway** | The service that holds player connections, serves snapshots and pushes deltas. Stateless apart from its live connections. |
| **House** | The thing a player plays: a noble lineage with a name, a banner, a seat and a treasury. One event stream each. `House` |
| **Player** | The human. Identified for now by an anonymous token generated in the browser. `PlayerId` |
| **Projection** | A read model built by folding events, kept in MongoDB and queried by the interface. The event store is never queried to draw the map. |
| **Rate** | A resource expressed as an amount, a rate per second, and the instant at which that was true. Clients interpolate between updates, so the world needs no tick events. |
| **Seat** | Where a house is founded: its place on the map, and the anchor of its sprite. `Location` |
| **Snapshot** | The current contents of a cell, sent when a client subscribes to it, before any deltas. |
| **Stream** | The ordered events of one aggregate instance, addressed as `house:<uuid>`. |
| **Tincture** | A heraldic colour. Metals are or and argent; colours are gules, azure, sable, vert and purpure. A charge of a metal goes on a field of a colour, and the reverse. `Tincture` |
| **Treasury** | The stored wealth of a house, expressed as a rate. The first resource in the world. `Treasury` |
| **World** | The single shared instance of Earth that every player is on. There are no shards. |
