package villages.domain

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
