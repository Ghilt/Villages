# 0027. Every event carries two times, and the world has a calendar of its own

- Status: accepted
- Date: 2026-09-05

## Context

`SETTING.md` describes a world that spans centuries and is played out of order: today in 1547, tomorrow in
1399, in a past that every player shares. The map has to show the world as it was on a day, the timeline
scrubber has to move that day, and the house-spirit has to run on the order things were actually done in.

Until now an event carried one instant, `at`, which was both when it happened and when it was written down,
because they had never differed. They are about to. And the store's own order - stream versions, the feed -
is recording order, which is the right order for the store and the wrong order for the map.

The catalogue had one event type. Adding a field to one event is a morning; adding it to a catalogue of
twenty, with fixtures and a read model for each, is not.

## Decision

**Every event carries two times.**

- `worldTime`: when it happened in the world's own calendar. What the map at a moment, the timeline
  scrubber and pins order by.
- `recordedAt`: when it was written down, by the server's clock. The store's order, the event feed's order,
  and the house-spirit's. This is what `at` was, renamed so nobody mistakes it for the other.

They are on the `HouseEvent` interface, so an event type cannot be added without both.

**World-time is a count of days from the first day of year one**, a `WorldTime` value in the domain that
knows only how to compare and add. The domain needs nothing more. **The calendar** - how that count is a
year and a day, and how it is spelled - lives in `protocol`, beside the cells, because the browser shows a
year and the server stores a day and they must agree; `contracts/fixtures/calendar.json` holds the vectors
both ends are held to. Years are three hundred and sixty-five days, all of them. A fictional calendar owes
nobody a leap day, and months can come when the fiction wants them.

**The world's day is a server fact.** A `WorldClock` port answers "what day is it in the world", and a
founding done now is recorded as having happened on that day. `SETTING.md`'s leaning is one shared day for
everyone, chosen daily by the chrono-engine; until there is one, `DailyWorldClock` advances one world-day
per real day since the world opened, on the first of September 2026, in year 1200. It is a placeholder
and it is one class.

**The read model carries a lifetime in world-time** - `since`, and `until` while open - and a cell is
queried at a day: the three conditions of decision 0026 plus *exists on this day*. **A connection has a
viewing day**, moved by one frame, `viewTime`; null means live. Moving it answers every held cell again
as of that day, and from then on the connection is told only of changes that exist on that day. The
scrubber is therefore one frame and no new query. `welcome` carries where the world's clock stands - today,
and the earliest day anything is known to exist from - which is the scrubber's range.

## Consequences

`villages.house.founded.v1` gained `worldTime` and renamed `at` to `recordedAt`, and kept its version, for
the reason 0026 gave: nothing has stored one durably yet. This is the last such change before the fixture
is a promise.

The CloudEvent's `time` attribute is `recordedAt`. That is what CloudEvents means by it - when the event
occurred in the system's terms - and it is what Occurrent orders by.

Playing the past becomes possible in principle without touching the store: a command carrying a
`worldTime` in a past century appends at the head like any other, and the read model's range query shows it
on the right day. What is not yet built is any way to issue such a command, or any rule about what it may
say - that is the chrono-engine, and it is after the seed.

The rate on a treasury still runs on the wall clock. Tickers interpolate real seconds; how a resource
behaves across a chrono jump is a question for the chrono-engine, recorded in `SETTING.md`.

## Alternatives considered

- **One time, the world's.** Then the store's order and the house-spirit's order are lost, and arbitration
  between two players acting in the same century has nothing to stand on. Recording order is the order of
  truth; see `SETTING.md`.
- **World-time as an `Instant` with a fictional epoch.** Reads as a real date in every log and debugger,
  and invites arithmetic with the real clock. A day count cannot be confused with anything.
- **World-time as year and day-of-year, a pair.** Two numbers to compare, sort and index where one will do.
  The pair is how it is *read*, and that is the calendar's job.
- **Put the calendar in the domain.** The domain has no need to know what a year is, and the browser
  needs the same arithmetic. `protocol` is where both ends already agree on the grid.
- **Re-subscribe to change the viewing day.** Unsubscribe and subscribe every held cell on every move of
  the scrubber, with the day on the subscription. Twice the frames, and a client that forgets to do both
  draws two days at once. One frame that the gateway answers with fresh snapshots is smaller and cannot
  be done by halves.
