package villages.domain

import kotlin.math.abs

/**
 * The rules of a character as two pure functions: decide turns a command and the current state into events,
 * evolve folds an event into the state. What a character is to a house is not decided here, because it is
 * the house's history and not the character's. See decision record 0055.
 */
object CharacterDecider : Decider<CharacterCommand, Character, CharacterEvent> {
    /** Every stat is a whole number from one to twenty. */
    val STAT_RANGE: IntRange = 1..20

    /** The most a cause of death may say, which is a line and not a story. */
    const val LONGEST_CAUSE = 120

    /** The most years a character can be aged, or made younger, at once. */
    const val MOST_YEARS_AT_ONCE = 200

    private const val DAYS_IN_A_SHORT_YEAR = 365L

    /** A portrait's key is a file's name without its `.png`: lower-case words joined by dashes, `woman-01`. */
    private val PORTRAIT_KEY = Regex("[a-z0-9]+(-[a-z0-9]+)*")
    private const val LONGEST_PORTRAIT_KEY = 40

    override val initial: Character = Character.NotAppeared

    override fun decide(command: CharacterCommand, state: Character): List<CharacterEvent> = when (command) {
        is IntroduceCharacter -> {
            if (state is Character.Appeared) {
                throw CharacterError.AlreadyAppeared
            }
            refuseUnlessEveryStat(command.stats)
            if (command.bornOn > command.worldTime) {
                throw CharacterError.InvalidAge("born on day ${command.bornOn.day}, after appearing on ${command.worldTime.day}")
            }
            command.portrait?.let(::refuseUnlessPortraitKey)
            listOf(
                CharacterAppeared(
                    characterId = command.characterId,
                    name = command.name,
                    sex = command.sex,
                    species = command.species,
                    bornOn = command.bornOn,
                    stats = command.stats,
                    portrait = command.portrait,
                    worldTime = command.worldTime,
                    recordedAt = command.recordedAt,
                ),
            )
        }

        is KillCharacter -> {
            living(state)
            if (command.cause.isBlank()) {
                throw CharacterError.InvalidCause("it is blank")
            }
            if (command.cause.length > LONGEST_CAUSE) {
                throw CharacterError.InvalidCause("it is longer than $LONGEST_CAUSE characters")
            }
            listOf(CharacterDied(command.characterId, command.cause, command.worldTime, command.recordedAt))
        }

        is ChangeStat -> {
            val character = living(state)
            if (command.by == 0) {
                emptyList()
            } else {
                val value = character.stats.getValue(command.stat) + command.by
                if (value !in STAT_RANGE) {
                    throw CharacterError.InvalidStat("${command.stat.name.lowercase()} would be $value, outside $STAT_RANGE")
                }
                listOf(CharacterStatChanged(command.characterId, command.stat, value, command.worldTime, command.recordedAt))
            }
        }

        is AgeCharacter -> {
            val character = living(state)
            if (command.years == 0) {
                emptyList()
            } else {
                if (abs(command.years) > MOST_YEARS_AT_ONCE) {
                    throw CharacterError.InvalidAge("${command.years} years at once is more than $MOST_YEARS_AT_ONCE")
                }
                // Nobody grows younger than newborn. A year is at least 365 days, which is as near as the
                // domain can come without a calendar, and it errs on the side of allowing the change.
                val daysOld = command.worldTime.day - character.bornOn.day
                if (daysOld + (character.agedYears + command.years) * DAYS_IN_A_SHORT_YEAR < 0) {
                    throw CharacterError.InvalidAge("${command.years} years would make them younger than newborn")
                }
                listOf(CharacterAged(command.characterId, command.years, command.worldTime, command.recordedAt))
            }
        }

        is MoveCharacter -> {
            val character = living(state)
            // Moving somebody to where they already stand, mattering as much as they did, is no move.
            if (command.place == character.place && command.significance == character.significance) {
                emptyList()
            } else {
                listOf(
                    CharacterMoved(
                        command.characterId,
                        command.place,
                        command.significance,
                        command.worldTime,
                        command.recordedAt,
                    ),
                )
            }
        }

        is TakeOffTheMap -> {
            val character = living(state)
            if (character.place == null) {
                throw CharacterError.NotOnTheMap
            }
            listOf(CharacterLeftTheMap(command.characterId, command.worldTime, command.recordedAt))
        }

        is ChangePortrait -> {
            val character = living(state)
            command.portrait?.let(::refuseUnlessPortraitKey)
            if (command.portrait == character.portrait) {
                emptyList()
            } else {
                listOf(CharacterPortraitChanged(command.characterId, command.portrait, command.worldTime, command.recordedAt))
            }
        }
    }

    override fun evolve(state: Character, event: CharacterEvent): Character = when (event) {
        is CharacterAppeared -> Character.Appeared(
            id = event.characterId,
            name = event.name,
            sex = event.sex,
            species = event.species,
            bornOn = event.bornOn,
            stats = event.stats,
            portrait = event.portrait,
            appearedOn = event.worldTime,
        )

        // A death on a character who never appeared cannot be reached: the decider refuses the command that
        // would write one. Evolve is total anyway, because a fold must never throw.
        is CharacterDied -> when (state) {
            is Character.NotAppeared -> state
            is Character.Appeared -> state.copy(death = Death(event.worldTime, event.cause))
        }

        is CharacterStatChanged -> when (state) {
            is Character.NotAppeared -> state
            is Character.Appeared -> state.copy(stats = state.stats + (event.stat to event.value))
        }

        is CharacterAged -> when (state) {
            is Character.NotAppeared -> state
            is Character.Appeared -> state.copy(agedYears = state.agedYears + event.years)
        }

        is CharacterPortraitChanged -> when (state) {
            is Character.NotAppeared -> state
            is Character.Appeared -> state.copy(portrait = event.portrait)
        }

        is CharacterMoved -> when (state) {
            is Character.NotAppeared -> state
            is Character.Appeared -> state.copy(place = event.place, significance = event.significance)
        }

        is CharacterLeftTheMap -> when (state) {
            is Character.NotAppeared -> state
            is Character.Appeared -> state.copy(place = null, significance = null)
        }
    }

    /** The character as they stand, or the refusal that says why nothing can be done to them. */
    private fun living(state: Character): Character.Appeared = when (state) {
        is Character.NotAppeared -> throw CharacterError.NoSuchCharacter
        is Character.Appeared -> if (state.death == null) state else throw CharacterError.AlreadyDead
    }

    private fun refuseUnlessEveryStat(stats: Map<Stat, Int>) {
        val missing = Stat.entries - stats.keys
        if (missing.isNotEmpty()) {
            throw CharacterError.InvalidStat("missing ${missing.joinToString { it.name.lowercase() }}")
        }
        stats.forEach { (stat, value) ->
            if (value !in STAT_RANGE) {
                throw CharacterError.InvalidStat("${stat.name.lowercase()} is $value, outside $STAT_RANGE")
            }
        }
    }

    private fun refuseUnlessPortraitKey(key: String) {
        if (key.length > LONGEST_PORTRAIT_KEY || !PORTRAIT_KEY.matches(key)) {
            throw CharacterError.InvalidPortrait("'$key' is not a file's name in lower-case words and dashes")
        }
    }
}
