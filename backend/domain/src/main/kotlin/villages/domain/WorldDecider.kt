package villages.domain

/**
 * What the world's own stream remembers: the version of each catalogue it last took on, by name, and the house bots it
 * made, each by its player, with the town it stands by.
 */
data class WorldRecord(val catalogues: Map<String, TakenOn>, val bots: Map<PlayerId, String> = emptyMap()) {
    /** A catalogue as the world last took it on. */
    data class TakenOn(val fingerprint: String, val text: String)
}

/**
 * The world's own rules, decided against its own stream: each version of a catalogue is recorded once, when it is
 * first taken on, and taking on the version last recorded writes nothing, so a server started again on the same
 * files is silent; and each house bot is made once (0108). [changes] says where two texts of a catalogue differ, which takes reading them, and reading them
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
        is CreateBots -> {
            command.bots.firstOrNull { it.town.isBlank() || it.player != PlayerId.botAt(it.town) }?.let {
                throw WorldError.InvalidBot("${it.player.value} is not the player of the town '${it.town}'")
            }
            command.bots.distinctBy { it.player }.filter { it.player !in state.bots }.map {
                WorldBotCreated(it.player, it.town, command.worldTime, command.recordedAt)
            }
        }
    }

    override fun evolve(state: WorldRecord, event: WorldStreamEvent): WorldRecord = when (event) {
        is WorldCatalogueChanged ->
            state.copy(catalogues = state.catalogues + (event.catalogue to WorldRecord.TakenOn(event.fingerprint, event.text)))
        is WorldBotCreated -> state.copy(bots = state.bots + (event.player to event.town))
    }

    private companion object {
        val FINGERPRINT = Regex("[0-9a-f]{64}")
    }
}
