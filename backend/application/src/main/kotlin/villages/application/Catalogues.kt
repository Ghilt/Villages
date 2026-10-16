package villages.application

import villages.domain.StructureCatalogue

/**
 * Every catalogue the game reads, read and checked: what the shelf holds in force, a field a catalogue. A new kind of
 * content adds its field here, its reader in `app`, and its checks against the rest to [check]. See decision record 0097.
 */
data class Catalogues(val structures: StructureCatalogue) {
    /**
     * What must hold between catalogues, as one more check before the shelf takes them on: every name one of them
     * gives another resolves. Throws [CatalogueRefused] naming the catalogue at fault. None yet, with one catalogue.
     */
    fun check(): Catalogues = this

    companion object {
        /** The structures' catalogue's name on the shelf, `world/catalogues/structures.json`. */
        const val STRUCTURES = "structures"
    }
}

/** Reads the catalogue files into what the game reads: a port, its adapter in `app`, which reads JSON. */
fun interface CatalogueReader {
    /** Every file on the shelf, by its name, read and checked; throws [CatalogueRefused] for the first it cannot take. */
    fun read(files: Map<String, String>): Catalogues
}

/** A catalogue the game server will not take on, and why, naming the file: what the log and the debug panel say. */
class CatalogueRefused(val catalogue: String, reason: String) :
    RuntimeException("world/catalogues/$catalogue.json: $reason")
