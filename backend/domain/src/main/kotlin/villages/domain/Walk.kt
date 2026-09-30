package villages.domain

/**
 * Where a dialogue has got to, worked out from the steps a house has taken through it: what has been said,
 * the stretch still to read up to and including the next step, and the options pending when that stretch
 * ends in a dialogue choice.
 *
 * Only the steps are recorded, and the plain lines between them are not, so this is how the rest is rebuilt:
 * every option taken is a step, which is what fixes the path. The decider allows a step only where this says
 * one is open, and what the player is sent is read off the same walk, so the two cannot disagree about where
 * a conversation stands. See decision record 0067.
 */
data class Walk(
    /** Every line along the path so far, in the order they were said, up to and including the last step. */
    val said: List<Line>,
    /**
     * The stretch still to read: up to and including the next step, or up to the line a dialogue choice
     * follows. Empty when a step has just been taken and a dialogue choice follows it, and when it is over.
     */
    val next: List<Line>,
    /** The options of the dialogue choice the stretch ends in, or none. */
    val options: List<Line>,
) {
    /** Whether the dialogue has reached its end: nothing is left to read, and nothing to choose. */
    val over: Boolean get() = next.isEmpty() && options.isEmpty()

    /**
     * Whether a step may be taken on this line now: one of the pending options, or the step the stretch ends
     * in. Nothing else, which is what pays a line's reward once on every path, paths that meet again and all.
     */
    fun allows(line: LineId): Boolean =
        if (options.isNotEmpty()) options.any { it.id == line } else next.lastOrNull()?.id == line
}

/**
 * A dialogue a house has open, and the steps it has taken through it so far, in order: what the house keeps of
 * a conversation it is in the middle of, and all it needs to know where the conversation stands.
 */
data class OpenDialogue(
    val dialogue: Dialogue,
    val taken: List<LineId> = emptyList(),
) {
    /** Where it has got to. */
    fun walk(): Walk = dialogue.walk(taken)
}

/**
 * Whether reaching this line is a step: it gives something, ends the dialogue, is marked to be recorded, or is
 * an option of a dialogue choice, taking which is the step. The rest are read and never recorded.
 */
fun Dialogue.isStep(line: Line): Boolean = isStep(line, optionLines())

/**
 * Where this dialogue stands after the steps taken through it, in the order they were taken.
 *
 * Each step has to be where the conversation goes next, and the house only ever records a step the walk
 * allows, so recorded steps that follow no route through the dialogue can only come from a fault - a bug, or a
 * damaged store. The walk refuses them rather than guess, because a guess would stand the dialogue at an
 * earlier point, where a step that pays could be taken, and paid, again.
 */
fun Dialogue.walk(taken: List<LineId>): Walk {
    val options = optionLines()
    val said = mutableListOf<Line>()
    var followed = 0
    var from = lines.first()

    fun lineWith(id: LineId): Line = line(id) ?: error("dialogue ${this.id.value} has no line ${id.value}")
    fun notAPath(reason: String): Nothing {
        val steps = taken.map { it.value }
        throw IllegalArgumentException("the steps $steps follow no route through the dialogue: $reason")
    }

    while (true) {
        // Read on from here to the next step, or to a line that a dialogue choice follows.
        val stretch = mutableListOf(from)
        while (!isStep(stretch.last(), options)) {
            val then = stretch.last().then as? Then.Say ?: break
            stretch += lineWith(then.line)
        }
        val last = stretch.last()
        // Every line that is not a step is followed by another or by a dialogue choice, and the loop above
        // only stops at one that is not followed by another; a line that ends it is a step.
        val choice = last.then as? Then.DialogueChoice

        if (isStep(last, options)) {
            if (followed == taken.size) return Walk(said, next = stretch, options = emptyList())
            val step = taken[followed]
            if (step != last.id) notAPath("${step.value} is taken where the next step is ${last.id.value}")
            said += stretch
            followed++
            when (val then = last.then) {
                Then.End -> {
                    if (followed < taken.size) notAPath("${taken[followed].value} is taken after the end")
                    return Walk(said, next = emptyList(), options = emptyList())
                }
                is Then.Say -> {
                    from = lineWith(then.line)
                    continue
                }
                is Then.DialogueChoice -> if (followed == taken.size) {
                    return Walk(said, next = emptyList(), options = then.options.map(::lineWith))
                }
            }
        } else {
            if (followed == taken.size) return Walk(said, next = stretch, options = choice!!.options.map(::lineWith))
            said += stretch
        }

        // An option taken: the path goes on from it, and taking it is the next step.
        val option = taken[followed]
        if (option !in choice!!.options) notAPath("${option.value} is not an option after ${last.id.value}")
        from = lineWith(option)
    }
}

private fun isStep(line: Line, options: Set<LineId>): Boolean =
    line.gives.isNotEmpty() || line.recorded || line.then == Then.End || line.id in options

/** Every line that is an option of some dialogue choice in this dialogue. */
private fun Dialogue.optionLines(): Set<LineId> =
    lines.flatMap { (it.then as? Then.DialogueChoice)?.options.orEmpty() }.toSet()
