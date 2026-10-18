# A mechanic is a module on the server

**What belongs here:** how the server stops making every mechanic add itself to shared lists - the lists, the steps
that remove them, the rules each step keeps, and the order. **What does not:** why a mechanic has one place in each
layer, which is decision record 0075 and its amendments; how a mechanic is built, which is `BUILDING-A-MECHANIC.md`;
the frontend's half of the cost, the debug panel's levers (M8) and the protocol written twice (M7).

Milestone M6 of the code-debt analysis of 2026-10-16 (debt D5), agreed with Adam on 2026-10-18.

## The problem

The code is grouped by mechanic inside each layer already (0075). What costs a mechanic 32 to 42 server files is that
each layer also keeps a list or two by hand, and every new mechanic adds itself to all of them. Of the 32 files the
quests' first commit touched, 6 were the quests' own logic and 15 were these:

| What a new mechanic adds | Where |
|---|---|
| A line ignoring its family, in every read model that has nothing to say about it | 7 projections: 0075 forbids an `else` |
| A row for each event | `EventTypes.kt`, and its copy in the gateway tests' `TinyWorld` |
| A line for each refusal | `Refusals.kt` |
| Its beans | `WorldConfig.kt`, 36 beans in 362 lines |
| A parameter, a field and a line | `GatewayConfig`, `Mechanics` (30 fields), `partsOf` |
| Its levers, and a constructor argument | `Instruments.kt` |

## The rules every step keeps

- **Every stored event keeps its type.** The catalogue tests and the recorded stores fail otherwise.
- **The wire does not move.** No frame changes, the protocol stays at its version and its recording still holds.
- **Every refusal keeps its code.** From step 3, a recording of every code fails otherwise.
- **No new events**, so there are no names to agree.
- **The game does what it did**: the end-to-end test, and the running program at each hand-over.

## Steps

| # | Step | Verification requests |
|---|---|---|
| 1 | **Read models name only what they hear.** Each projection routes by family with one `else`, and is exhaustive within every family it names, so a new event in a family it hears is placed by the compiler and a new family costs it nothing. Decision record 0075 amended. | The checks. Read the amendment to 0075. |
| 2 | **Event types by rule.** A type is worked out from its class, by the rule the catalogue test already holds, with a list of the exceptions; `EventTypes` and the tests' `TinyWorld` both use it. | The checks: the catalogue tests and the recorded stores hold every type unchanged. |
| 3 | **Refusal codes by rule.** A code is worked out from its error's class, with a list of the exceptions, and a recording of every code fails the checks if one moves. | The checks. Read the recording. |
| 4 | **A configuration per mechanic.** `WorldConfig` split into houses, resources, choices, fate, visions, dialogues, quests and characters, and a core: a move and nothing else. | The checks. 👀 The game runs as it did: found a house, take an action, a quest. |
| 5 | **A mechanic's gateway part is its own bean.** Each configuration declares its part, and the gateway is given the list, in the order the parts say; each mechanic's levers leave `Instruments` for a file of its own; `Mechanics` keeps what the core reads. `BUILDING-A-MECHANIC.md` says what a new mechanic now touches. | 👀 Every lever of the debug panel still works: found, grant, give vision, offer a dialogue, offer a quest. Read the new checklist. |

A new mechanic on a house's stream should then touch 15 to 18 server files: its own, the house decider's two routes,
and the documents. The next mechanic built is the measurement.
