package villages.application

/**
 * The portraits there are to give a character: every picture's key, which is its file's name without the
 * `.png`, and whose first word says whom it suits, `woman-01`. Asked each time, so a picture saved into the
 * folder is given out without a restart. See `docs/plans/characters-and-key-figures.md`.
 */
fun interface Portraits {
    fun keys(): List<String>
}
