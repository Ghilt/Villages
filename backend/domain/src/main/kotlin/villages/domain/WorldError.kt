package villages.domain

/** Everything the world's own stream can refuse, thrown from `decide`. One branch of [DomainError]. See 0097. */
sealed class WorldError(message: String) : DomainError(message) {
    class InvalidCatalogue(reason: String) : WorldError("not a catalogue: $reason")
}
