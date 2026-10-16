package villages.domain

/** What the world's own stream remembers: the version of each catalogue it last took on, by name. */
data class WorldRecord(val catalogues: Map<String, TakenOn>) {
    /** A catalogue as the world last took it on. */
    data class TakenOn(val fingerprint: String, val text: String)
}

/**
 * The world's own rules, decided against its own stream: each version of a catalogue is recorded once, when it is
 * first taken on, and taking on the version last recorded writes nothing, so a server started again on the same
 * files is silent. [changes] says where two texts of a catalogue differ, which takes reading them, and reading them
 * is the server's, not the domain's. See decision record 0097.
 */
class WorldDecider(private val changes: (before: String, after: String) -> List<String>) :
    Decider<WorldCommand, WorldRecord, WorldStreamEvent> {
    override val initial: WorldRecord = WorldRecord(emptyMap())

    override fun decide(command: WorldCommand, state: WorldRecord): List<WorldStreamEvent> = when (command) {
        is TakeOnCatalogue -> {
            if (!isCatalogueName(command.catalogue)) {
                throw WorldError.InvalidCatalogue("a name on the shelf, as structures or dialogues/letter, not '${command.catalogue}'")
            }
            if (!FINGERPRINT.matches(command.fingerprint)) {
                throw WorldError.InvalidCatalogue("a SHA-256 in hex, not '${command.fingerprint}'")
            }
            val last = state.catalogues[command.catalogue]
            if (last?.fingerprint == command.fingerprint) {
                emptyList()
            } else {
                listOf(
                    WorldCatalogueChanged(
                        catalogue = command.catalogue,
                        fingerprint = command.fingerprint,
                        previous = last?.fingerprint,
                        changed = last?.let { changes(it.text, command.text) }.orEmpty(),
                        text = command.text,
                        worldTime = command.worldTime,
                        recordedAt = command.recordedAt,
                    ),
                )
            }
        }
    }

    override fun evolve(state: WorldRecord, event: WorldStreamEvent): WorldRecord = when (event) {
        is WorldCatalogueChanged ->
            WorldRecord(state.catalogues + (event.catalogue to WorldRecord.TakenOn(event.fingerprint, event.text)))
    }

    private companion object {
        val FINGERPRINT = Regex("[0-9a-f]{64}")
    }
}
