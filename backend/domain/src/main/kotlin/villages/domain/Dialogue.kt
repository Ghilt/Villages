package villages.domain

import java.util.UUID

/**
 * One conversation offered to a house, whole: who speaks, every line, every dialogue choice, what each line
 * does to the house, and what the dialogue requires.
 *
 * Recorded whole on the event that offers it, as a choice is, so the roads not taken are history too and every
 * step can be checked against the house's own history alone. It checks itself when it is made, and a dialogue
 * that could loop, or that names somebody or something it does not hold, is refused before anything is
 * written. Anything about the house that shapes it is settled when it is written, and from then on it is
 * fixed. See decision record 0067.
 */
data class Dialogue(
    val id: DialogueId,
    /** What the list of dialogues shows. */
    val title: String,
    /** The picture at the top of the conversation, by its key, or none. */
    val scene: String?,
    val speakers: List<Speaker>,
    /** Every line of it. The first is where it opens. */
    val lines: List<Line>,
    /** What it was written to need, beyond what [needs] works out from the speakers. */
    val requirements: List<Requirement> = emptyList(),
) {
    init {
        if (title.isBlank()) {
            refuse("a dialogue has a title")
        }
        if (lines.isEmpty()) {
            refuse("a dialogue has a line to open on")
        }
        refuseUnlessWords(speakers.map { it.id.value }, "speaker")
        refuseUnlessWords(lines.map { it.id.value }, "line")
        refuseUnlessSaidProperly()
        refuseUnlessEveryPathEnds()
    }

    /** The line with this id, or null when the dialogue has none. */
    fun line(id: LineId): Line? = lines.firstOrNull { it.id == id }

    /**
     * Everything that has to stay true until it is finished: what it was written to need, and every speaker
     * who is a character alive, which is worked out rather than written.
     */
    fun needs(): Set<Requirement> =
        requirements.toSet() + speakers.mapNotNull { it.character }.map { Requirement.Alive(it) }

    private fun refuseUnlessWords(ids: List<String>, what: String) {
        ids.firstOrNull { it.isEmpty() || it.length > LONGEST_ID || it.any(Char::isWhitespace) }?.let {
            refuse("a $what's id is a word of at most $LONGEST_ID characters, and \"$it\" is not")
        }
        if (ids.distinct().size != ids.size) {
            refuse("two ${what}s of one dialogue share an id")
        }
    }

    private fun refuseUnlessSaidProperly() {
        val speaking = speakers.map { it.id }.toSet()
        val said = lines.associateBy { it.id }
        val options = lines.flatMap { (it.then as? Then.DialogueChoice)?.options.orEmpty() }.toSet()
        speakers.firstOrNull { it.name.isBlank() }?.let { refuse("speaker ${it.id.value} has no name") }
        for (line in lines) {
            val which = "line ${line.id.value}"
            if (line.speaker !in speaking) refuse("$which is said by ${line.speaker.value}, who is not speaking")
            if (line.words.isBlank()) refuse("$which says nothing")
            // A step whose effect could be refused would make the dialogue impassable at that line, so a founding
            // is refused outright, and a spend - which a house that cannot pay refuses - only an option may make.
            if (line.effects.any { it is Effect.FoundAt }) {
                refuse("$which founds a house, and a dialogue is offered to a house that is founded already")
            }
            if (line.effects.any { it is Effect.Spend } && line.id !in options) {
                refuse("$which spends, and only an option may, so that a house that cannot pay can answer otherwise")
            }
            if (line.revealImpact != null && line.id !in options) {
                refuse("$which shows its impact, and only an option is shown before it is taken")
            }
            line.then.following().firstOrNull { it !in said }?.let {
                refuse("$which leads to line ${it.value}, which the dialogue does not have")
            }
            val then = line.then
            if (then is Then.DialogueChoice) {
                if (then.options.size !in FEWEST_OPTIONS..MOST_OPTIONS) {
                    val many = then.options.size
                    refuse("$which leads to a dialogue choice of $many, not $FEWEST_OPTIONS to $MOST_OPTIONS")
                }
                if (then.options.distinct().size != then.options.size) {
                    refuse("$which leads to a dialogue choice offering one line twice")
                }
                if (then.options.all { option -> said.getValue(option).effects.any { it is Effect.Spend } }) {
                    refuse("$which leads to a dialogue choice whose every option spends: a house that cannot pay is stuck")
                }
            }
        }
    }

    /**
     * No line can be reached from itself, so every path through the dialogue ends and a line's reward is paid
     * once on any of them; and every line is reached from the first, so nothing written is never said. A
     * conversation that comes back to a question it asked is refused for now, until the walk learns to loop.
     */
    private fun refuseUnlessEveryPathEnds() {
        val byId = lines.associateBy { it.id }
        val reached = mutableSetOf<LineId>()
        val onThePath = mutableSetOf<LineId>()

        fun walk(id: LineId) {
            if (id in reached) return
            if (!onThePath.add(id)) {
                refuse("line ${id.value} can be reached from itself, so a path through the dialogue would not end")
            }
            byId.getValue(id).then.following().forEach(::walk)
            onThePath -= id
            reached += id
        }

        walk(lines.first().id)
        lines.firstOrNull { it.id !in reached }?.let { refuse("nothing leads to line ${it.id.value}") }
    }

    private fun refuse(reason: String): Nothing = throw HouseError.InvalidDialogue(reason)

    companion object {
        /** A dialogue choice with one option is not a choice, as a choice with one option is not. */
        const val FEWEST_OPTIONS = Choice.FEWEST

        /** And more than a choice offers is a menu. */
        const val MOST_OPTIONS = Choice.MOST

        /** An id is a word to write a dialogue with, not a sentence. */
        const val LONGEST_ID = 64
    }
}

/**
 * Somebody speaking in a dialogue: which side of it they are on, what they are called and how they look, and
 * who they are in the world when they are a character. A messenger can speak without being one.
 */
data class Speaker(
    val id: SpeakerId,
    /**
     * Which side of the conversation they are on, the people in one party being with each other. The number
     * says nothing about a screen: the pane puts even parties on one side and odd ones on the other.
     */
    val party: Int,
    val name: String,
    /** A portrait's key, or none. */
    val portrait: String?,
    /** The character they are, or none for somebody who is not a character. A character is required alive. */
    val character: CharacterId?,
)

/**
 * One thing said in a dialogue: who says it, the words, what saying it does to the house, and what follows it.
 *
 * A line with an effect, one that ends the dialogue, or one marked [recorded], is a step when it is
 * reached, and so is every option of a dialogue choice when it is taken; the rest are read and not recorded.
 */
data class Line(
    val id: LineId,
    val speaker: SpeakerId,
    val words: String,
    /**
     * What saying it does to the house, the same thing an option of a choice carries, written as the world's own
     * events when it is reached: a grant, or on an option a spend.
     */
    val effects: List<Effect> = emptyList(),
    /** Whether reaching it is recorded even when it does nothing and ends nothing. */
    val recorded: Boolean = false,
    val then: Then,
    /** On an option, how it shows what taking it will do before it is taken; none shows nothing. */
    val revealImpact: RevealImpact? = null,
)

/**
 * How an option shows what taking it will do, before it is taken: written by hand on the option by whoever wrote
 * the dialogue, so the page draws it and nothing reads ahead down the path. It promises nothing - what the house
 * is given or spends is still the lines' effects - and keeping the two in step is the writer's. An option with
 * none shows nothing, and what it does is seen when it is done. See decision record 0067.
 */
sealed interface RevealImpact {
    /** What it will do, shown: a resource and an amount each, and a cost as an amount below nothing. */
    data class Shown(val impacts: List<Impact>) : RevealImpact {
        init {
            if (impacts.isEmpty()) {
                throw HouseError.InvalidDialogue("an impact shown shows something")
            }
        }
    }

    /** That it will do something, and not what: the page shows it as unknown. */
    data object Hidden : RevealImpact
}

/** Some of one resource, gained or, below nothing, lost: `+100` wealth, or `-40`. Never nothing. */
data class Impact(val resource: Resource, val amount: Long) {
    init {
        if (amount == 0L) {
            throw HouseError.InvalidAmount("an impact is of more or less than nothing, and 0 is neither")
        }
    }
}

/** What follows a line: another line, a dialogue choice, or the end. */
sealed interface Then {
    /** Another line is said next. */
    data class Say(val line: LineId) : Then

    /**
     * The player picks what is said or done next: two to four options, each a line. Not a choice roll, though
     * the two are alike, and written whole when the dialogue is offered.
     */
    data class DialogueChoice(val options: List<LineId>) : Then

    /** The dialogue ends here, which makes this line a step. */
    data object End : Then
}

/** The lines a line can lead to: the next one, a dialogue choice's options, or none at the end. */
internal fun Then.following(): List<LineId> = when (this) {
    is Then.Say -> listOf(line)
    is Then.DialogueChoice -> options
    Then.End -> emptyList()
}

/**
 * Something a dialogue needs to stay true until it is finished. Each kind says what in the world it depends on,
 * and which event breaks it, so a new kind - a building still standing, broken when it is destroyed - is one
 * more case here rather than new machinery. Hidden from the player, who learns of one only when it fails and
 * the dialogue lapses. See decision record 0067.
 */
sealed interface Requirement {
    /** That a character is still alive. Every speaker who is a character needs this of the dialogue. */
    data class Alive(val character: CharacterId) : Requirement
}

/**
 * Which requirements an event breaks: the one place a kind of requirement says which event ends it. A death
 * breaks a character's being alive, and nothing else yet breaks anything. A new kind is a case of
 * [Requirement] and a branch here - a building still standing, broken when it is destroyed - and whatever
 * carries a failure to the houses never changes for it. See decision record 0067.
 */
fun requirementsBrokenBy(event: Event): Set<Requirement> = when (event) {
    is CharacterDied -> setOf(Requirement.Alive(event.characterId))
    else -> emptySet()
}

/** The identity of one dialogue, so a step can only answer a dialogue the house was offered. */
@JvmInline
value class DialogueId(val value: UUID) {
    companion object {
        /** What a dialogue is named after, so the derivation cannot collide with anything else. */
        private const val NAMED_AFTER = "villages:dialogue:"

        /**
         * The dialogue a command offers a house. Worked out rather than minted, as a character's identity is, so
         * that the same command sent twice offers one dialogue and the house refuses the second offer rather than
         * holding two. The house is in the name as well as the command, because a command's id is public.
         */
        fun offered(house: HouseId, commandId: UUID): DialogueId =
            DialogueId(UUID.nameUUIDFromBytes("$NAMED_AFTER${house.value}:$commandId".toByteArray(Charsets.UTF_8)))
    }
}

/** Who says a line, within one dialogue. A word rather than a number, so a dialogue written by hand reads. */
@JvmInline
value class SpeakerId(val value: String)

/** One line within one dialogue. A word, as a speaker's is, and what a step names. */
@JvmInline
value class LineId(val value: String)
