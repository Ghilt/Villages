# 0014. A conversation beside the map

- Status: open
- Started: 2026-09-27

## Hypothesis

**A conversation can be offered whole and recorded only where it matters, carry what it pays as the house's
own history, and still read as people talking rather than as a log.** A dialogue picked up again lands on
the path it was left on; what a line gives is given once, whatever path led to it; a dialogue whose speaker
has died cannot be finished; a new kind of requirement costs only its own two answers; and a column with a
scene above a feed of bubbles, beside the map, makes a character read as somebody with a manner.

It is wrong if a dialogue reopened ever lands off the path it was left on, if a reward is paid twice or not
at all on any path, if a dialogue can still be stepped once its speaker's death has been written into it, if
a conversation of forty lines costs the history more than a handful of events, if a second kind of
requirement needs anything but a case, the event that breaks it and a line of words, or if, by eye, the
column reads as a chat log rather than as people talking.

## Setup

The build in `docs/plans/character-dialogue.md`, shaped by decision record 0067: a dialogue offered whole on
the house's stream, only its dialogue choices and the lines that give something or end it recorded, what a
line gives written as the world's own event from the same decision, hidden requirements whose failures one
listener carries to every house that depends on them, the server holding back what the player has not
reached, and a pane in a new column down the right of the spread. Nothing in the world offers a dialogue.
The debug panel's Dialogues section does, with one sample written in the server.

As little as possible: one sample, one kind of requirement, no storyline, no dialogue choice shaped by the
world when it is reached, no roll inside one, no conversation that comes back to a question.

## What we will look at

**The architecture**, answered as the steps land:

- Whether every path through the sample pays each reward once, and a resent step writes nothing twice, as
  tests.
- Whether a dialogue reopened, in another window or after a reload, lands on the path it was left on.
- How many events one conversation played through writes, against how many lines it has.
- Whether a speaker's death ends a dialogue, whoever the speaker is to the house, and whether the race
  between a step and a death ever shows.
- Whether a second kind of requirement costs only its own two answers and a line of words. There are no
  buildings to try it on, so the listener is tried in a test with a made-up rule of which event breaks
  which requirement, to show that nothing in it knows the kinds.
- Whether the page is ever sent a line it has not reached, or a requirement it did not ask for.

**The experience**, by eye:

- The pane at its three sizes in the spread and at its six states on a phone, with none, one and several
  dialogues waiting and finished.
- Whether the scene, and a portrait on every bubble, make two speakers read as two people facing each
  other.
- Whether a lost dialogue's closing line reads as the world moving on rather than as an error.

## Observations

**2026-09-27, the documents are written and nothing is built.** Writing them down moved four things. The
point where a conversation branches is a **dialogue choice** and not a choice roll, in Adam's words, because
some are plain choices of what to say and only some will gamble. Recording every *next* was dropped in
favour of recording only the steps that matter. Holding back what the player has not reached turned out to
need more than the frame that carries it: the event page is fed every stored event whole, so gating it went
on the roadmap, before any dialogue carries the setting's secret. And ending a dialogue when a requirement
fails took four drafts. The first gave dialogues a listener of their own, with a flavourful name like the
one the listener for character deaths had then, and Adam found both names unnecessary for what is only a
technical listener, so that one has its plain name now; the second carried a death and a day as two kinds
of news, which took his two examples for the whole design; the third folded the listener for character
deaths in, which brought key figures into a mechanic about characters talking. A requirement is a value
now, about characters and whatever else a dialogue depends on, and one listener carries whatever breaks
one, so a building destroyed would be one more kind rather than one more listener.

**2026-09-28, the offer is in the source.** A dialogue checks itself and is written whole on the house's
stream, and a choice's option can grant. One cost the documents had not counted showed at once: a new kind of
requirement is its case, the event that breaks it and a line of words, and also its `kind` in the store and a
case in a fixture, because every command on a house reads the whole stream, and a case the store could write
and not read back would break every one of them. A test demands both now. It was tried with a made-up kind,
and refused it twice: once for having no name in the store, and once, named, for having no fixture.

## Result

Open.

## Decision

Open.

## Follow-ups

Open.
