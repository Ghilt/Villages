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

**2026-09-29, a step can be taken.** The first number the hypothesis asked for: a conversation of forty lines
with one dialogue choice and one purse, played through one branch, reads thirty lines and writes six events -
the offer, three steps, what one of them gives, and the end. Against a line an event, that is the handful the
design was for, and it is a test now rather than a hope. A step already passed is refused as not the next
one, so every path through the sample pays once.

**2026-09-30, a speaker's death ends the dialogue.** The listener for broken requirements was tried with a
made-up rule of what breaks what - losing a key figure breaking their being alive - and carried it exactly as
it carries a death, so the claim that a second kind costs only its case and its branch holds of the listener:
nothing in it knows a kind. Killing the letter's speaker on a running server ends it as lost, naming the
requirement, within the death's own story. One thing it showed was not about dialogues at all: the booted
server's tests share one world, and a window that watches events is shown the recent ones on arriving, so a
test waiting for "a loss" took another test's loss for its own. It waits for its own story's now.

**2026-10-01, the pane stands in a column of its own, and opens when a dialogue is offered.** Fitting the
column to the spread changed one thing the plan had: as planned it took everything up to a gutter from the
left column, which on a stage 768 wide left 16 pixels of map, and for good, since the pane is never closed.
It is squeezed to a third first now, as the left one is, which leaves 192 there (0069). One case cannot be
looked at yet: the letter and a dialogue together, because the only letter is the founding one, so the tests
hold it. What opens the pane is a dialogue waiting that the page has not been shown before, so a step, a
reconnect or the list sent again never reopens a pane the player put away; a test proves it by making the
page forget.

The list showed one thing about words: a speaker's name is written to stand alone, as it will on a bubble -
*A messenger* - and is wrong inside a sentence, *Frederick Falk and A messenger*. So the list names each
alone, *Frederick Falk · A messenger*, rather than mending capitals in a language that may not be English.

## Result

Open.

## Decision

Open.

## Follow-ups

Open.
