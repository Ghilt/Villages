# 0097. Game content is catalogues kept in files, and the world records each one it takes on

- Status: accepted
- Date: 2026-10-15

## Context

Adam's brief of 2026-10-15 asks for a page like `/admin/inspect-structures` for every kind of content - the
dialogues, the quests, the rolls and their pools, the sprites and the marks - pages that can change what they
show, and a rule that makes every later plan with content in it build its page. It asks three questions with
it: whether content and balance are hard-coded or in MongoDB, whether they should be in MongoDB, and how a
changed value is handled once the game is released - *is a balance change an event?*

What the program has:

- **One kind of content is a file.** `world/structures.json` holds every type of structure, read once by the
  game server as it starts and by the page through the dev server (0093: "the catalogue is data").
- **The rest is code.** The dialogues, the quests, the pools and the actions, the names newcomers are given,
  and nearly every number Adam tunes are written in Kotlin in `domain` and `application`. Two numbers are
  copied into the page as well.
- **MongoDB holds what happened**: the events and the subscriptions' checkpoints, in a database of each tree's
  own (0092).
- **What happened is already safe from a retune.** An offered dialogue, quest or choice is written into its
  event whole (0071, 0096); what a structure paid and let its holder see is written into the house's own
  history (0093); a stored event is read as it was written (0074).
- **What a retune changes is not explained.** The standing-effects listener sets every holding right once it
  has caught up, so a retuned `structures.json` writes a new `incomeChanged` for every house at the next start.
  Nothing in the history says why the rate moved.
- **Each worktree is a branch with a database of its own**, and work reaches main by its branch alone.

## Decision

**Game content is catalogues, kept in files.** A catalogue is a committed file of content under
`world/catalogues/`, or a folder of them: the types of structure, the balance, the pools and actions, the
character names, the dialogues, the quests. An entry's own numbers live with the entry; a number that belongs
to no one entry lives in the balance. MongoDB keeps what happened and nothing the game is made of.

**Changing a catalogue is a commit, like changing code.** Who changed a word, when and why is git's, as it is
for code. Content that is genuinely code - an action that reads the world, as gossip does - stays code, and
the catalogue names it and gives it its numbers and its words.

**The world records each catalogue it takes on, and only that.** When the game server takes on a version of a
catalogue whose fingerprint it has not recorded, it writes `villages.world.catalogueChanged.v1` on the world's
own stream, carrying the catalogue's name, its fingerprint, the previous one, where the two differ and the
whole text. What a change sets right - a house's income, its sight - is written after it, by the listeners
that already write it, with the change as the cause. A number touches three things, and each differently:

- **what happened** never changes, because every event writes the numbers it used;
- **what is in flight** keeps what it was given: an offered quest keeps its words, and a standing income is
  declared again under the change;
- **what happens next** reads the catalogue in force.

**The game server checks a catalogue before it takes it on, and is the one that writes one.** It takes on only
a catalogue that passes every check - its shape, the domain's own, every reference into another catalogue - and
leaves the one in force running when a file fails. An inspect page saves through it, as a lever of the
instruments, and a save based on a file that has since changed on disk is refused.

**An id is kept forever once the world is.** After the world-persistence milestone, an entry that stored
events name - a type of structure, an action - is retired and never deleted or reused, as an event type is
(0011). Until then the wipe covers it.

**Every catalogue has its inspect page**, and a plan that adds a kind of content builds both.

## Consequences

- A branch carries its content to main with its code, a check of the content runs in `gradlew check` without
  Docker, and a wipe forgets the world and never the game.
- The world's history alone says which numbers were in force at every moment, at the cost of one catalogue's
  whole text in an event for each version taken on. A tree's world takes on every small edit made while it
  runs, and the pre-alpha wipe keeps that small.
- A fresh world's history opens with one `catalogueChanged` for each catalogue it was made of.
- The world gains a stream of its own, beside the houses', the characters' and the structures'. It decides
  one thing for now.
- Moving the content out of Kotlin costs a reader at each end, a fixture and a set of checks for every
  catalogue, and a few roles a dialogue names rather than a person - the house's key figure, its seat.
- A released page has no dev server to read a catalogue through, which the structures' page already lacks.
  It is answered when a released build is.
- Editing needs the game server running and `villages.catalogues.editable`, which is on unless a released server
  turns it off, as it turns off the instruments; reading needs nothing.

## Alternatives considered

- **Content in MongoDB.** A quest added in a worktree would stay in that tree's database and never reach main
  with its branch, a wipe would take the content with the world, and every check of it would need Docker.
  Rejected. It is where a catalogue might belong if Adam tunes a shared server while it runs, without a deploy;
  even then it would be files, fingerprinted and taken on.
- **Every edit an event**, a catalogue as an aggregate with `structureTypeRetuned` and its kin. An edit of a
  word is not a happening in the world, and git already keeps who changed what and why. Rejected: the world
  records what it took on, not how it was written.
- **No event**, a retune taking effect at the next start as today. Every house's income would go on moving with
  nothing in the history to say why. Rejected.
- **The dev server as the writer**, saving the file the page sends. The checks that matter - a dialogue's own,
  a reference into another catalogue - are the server's, so a page could save a file the server then refused,
  and nobody would be told. Rejected.
- **Content left in code, with pages that only read it.** Nothing could be edited, which was the point.
  Rejected on Adam's word.
