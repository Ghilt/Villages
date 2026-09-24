package villages.application

import villages.domain.Sex

/**
 * The names a newcomer can be given: given names of the 1790s by sex, and family names from across the
 * old continent, bent the way the coastlines are bent.
 *
 * A hand-kept list, as the gazetteer of seats is, and content: Adam's to steer. None of them is anybody
 * famous on purpose, because a player who meets a character called after a real person meets a joke rather
 * than a person. Every name here is a valid `CharacterName`, which a test holds.
 */
object Names {
    private val women: List<String> = listOf(
        "Agnes", "Anne", "Catherine", "Charlotte", "Dorothea", "Eleanor", "Elisabeth", "Frances", "Hannah",
        "Harriet", "Henriette", "Isabella", "Johanna", "Louise", "Margarethe", "Marianne", "Sophia", "Susanna",
        "Theresa", "Ursula",
    )

    private val men: List<String> = listOf(
        "Anton", "Augustin", "Balthasar", "Christian", "Edmund", "Frederick", "Gottfried", "Henri", "Jacob",
        "Johann", "Joseph", "Laurent", "Matthias", "Nicholas", "Philip", "Pieter", "Samuel", "Thomas",
        "Tobias", "Wilhelm",
    )

    val family: List<String> = listOf(
        "Achterberg", "Ashby", "Aubert", "Bellamy", "Bonnard", "Brandt", "Carrow", "Castell", "Corder",
        "Dufresne", "Duvall", "Ellery", "Everard", "Falk", "Fenwick", "Garnier", "Hartwell", "Holm", "Ingram",
        "Jessop", "Kemble", "Lindqvist", "Marchand", "Morell", "Norrey", "Orme", "Pelham", "Quarles",
        "Rennard", "Ricci", "Sallow", "Scheel", "Thorne", "Tremaine", "Ulver", "Vane", "Varga", "Waldron",
        "Wren", "Ystad",
    )

    fun given(sex: Sex): List<String> = when (sex) {
        Sex.WOMAN -> women
        Sex.MAN -> men
    }
}
