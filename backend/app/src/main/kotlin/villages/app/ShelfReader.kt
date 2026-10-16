package villages.app

import villages.application.CatalogueReader
import villages.application.CatalogueRefused
import villages.application.Catalogues

/**
 * The catalogue files read into what the game reads, one reader a catalogue, each strict: a field it cannot read
 * refuses the whole file, naming it. A file on the shelf the game has no reader for is refused too, because a
 * catalogue nothing reads is content nobody sees. See decision record 0097.
 */
object ShelfReader : CatalogueReader {
    /** Every catalogue the game reads, by its name on the shelf. */
    val READ: Set<String> = setOf(Catalogues.STRUCTURES, Catalogues.BALANCE, Catalogues.FATE, Catalogues.CHARACTER_NAMES)

    override fun read(files: Map<String, String>): Catalogues {
        files.keys.firstOrNull { it !in READ }?.let { throw CatalogueRefused(it, "the game reads no catalogue of that name") }
        return Catalogues(
            structures = reading(files, Catalogues.STRUCTURES, StructureCatalogueFile::parse),
            balance = reading(files, Catalogues.BALANCE, BalanceFile::parse),
            fate = reading(files, Catalogues.FATE, FateFile::parse),
            characterNames = reading(files, Catalogues.CHARACTER_NAMES, CharacterNamesFile::parse),
        ).check()
    }

    /** One catalogue, read by [parse]: missing, or unreadable, it is refused by name. */
    private fun <T> reading(files: Map<String, String>, catalogue: String, parse: (String) -> T): T {
        val text = files[catalogue] ?: throw CatalogueRefused(catalogue, "it is not on the shelf")
        return try {
            parse(text)
        } catch (@Suppress("TooGenericExceptionCaught") unreadable: RuntimeException) {
            throw CatalogueRefused(catalogue, unreadable.message?.substringAfter(": ") ?: unreadable.javaClass.simpleName)
        }
    }
}
