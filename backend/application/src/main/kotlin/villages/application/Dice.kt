package villages.application

/**
 * Chance, as a die with some number of sides: `roll(6)` is one to six. A port so that a use case that rolls
 * can be tested with a die that always comes up the same.
 *
 * Never seeded from anything a client sends: a command's id is the browser's to mint, and a roll seeded from
 * it could be sent again until it came up four eighteens.
 */
fun interface Dice {
    fun roll(sides: Int): Int
}
