# Recorded stores

Whole histories of little worlds, one file each, written by the code of the day in its name and never changed after:
one stored CloudEvent a line, oldest first. `StoredWorldSpec` replays every file here on every check - each event must
still read, through the upcasters if its type has been retired, and each stream must still fold - so a change to an
event's shape that would strand what older code wrote fails until it brings its upcaster. A new recording is a
deliberate act: `cd backend` then `./gradlew :infrastructure-occurrent:test -Dstore.record=true`, which writes today's
file. See decision record 0100.
