package villages.application

import villages.domain.CharacterError
import villages.domain.CharacterName
import villages.domain.Sex

/**
 * The names a newcomer can be given, `world/catalogues/character-names.json`: given names of the 1790s by sex, and
 * family names from across the old continent, bent the way the coastlines are bent. Content, Adam's to steer. None of
 * them is anybody famous on purpose, because a player who meets a character called after a real person meets a joke
 * rather than a person. Not the place names of the world, which are `world/names/`. See decision record 0097.
 */
data class CharacterNames(val women: List<String>, val men: List<String>, val family: List<String>) {
    fun given(sex: Sex): List<String> = when (sex) {
        Sex.WOMAN -> women
        Sex.MAN -> men
    }

    /**
     * What must hold of the names, as they are taken on: every list has a name in it, and every given name and family
     * name together are a name a character can have, so no newcomer is ever refused for their name.
     */
    fun check(): CharacterNames {
        fun refuse(at: String, must: String): Nothing = throw CatalogueRefused(Catalogues.CHARACTER_NAMES, "$at $must")
        if (women.isEmpty()) refuse("given.woman", "has a name in it")
        if (men.isEmpty()) refuse("given.man", "has a name in it")
        if (family.isEmpty()) refuse("family", "has a name in it")
        // Each half of a name is checked beside a half that is good, so a bad one is blamed and no other.
        for ((at, names) in listOf("given.woman" to women, "given.man" to men)) {
            names.forEach { name -> nameable(at, name, refuse = ::refuse) { CharacterName(it, GOOD) } }
        }
        family.forEach { name -> nameable("family", name, refuse = ::refuse) { CharacterName(GOOD, it) } }
        return this
    }

    private companion object {
        /** Half a name that is a name a character can have, to check the other half beside. */
        const val GOOD = "Anne"
    }

    private fun nameable(at: String, name: String, refuse: (String, String) -> Nothing, make: (String) -> CharacterName) {
        try {
            make(name)
        } catch (wrong: CharacterError.InvalidName) {
            refuse(at, "are names a character can have: '$name' is not, ${wrong.message}")
        }
    }
}
