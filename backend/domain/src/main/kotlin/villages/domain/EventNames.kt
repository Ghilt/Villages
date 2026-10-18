package villages.domain

import kotlin.reflect.KClass

/**
 * The name an event is catalogued and stored under, by the rule `docs/EVENTS.md` states: villages, whose event it is,
 * the event in the past tense. `HouseFounded` is `villages.house.founded`, `PlayerGivenChoice` is
 * `villages.player.givenChoice`. A world event is the history of the thing whose stream it is on, so it is named for
 * that stream; a player's is the player's wherever it is kept.
 *
 * The version is not part of the rule. It is a decision made when an event's shape changes (0100), so whoever stores
 * an event says it; the catalogue test holds both to `docs/EVENTS.md`. See `docs/plans/mechanic-modules.md`, step 2.
 */
object EventNames {
    /** Every kind of stream an event can be kept on, and the word its world events are named under. */
    private val streams: List<Pair<Class<out Event>, String>> = listOf(
        HouseEvent::class.java to "house",
        CharacterEvent::class.java to "character",
        StructureEvent::class.java to "structure",
        WorldStreamEvent::class.java to "world",
    )

    /** `villages.<whose>.<verb>`, without the version. */
    fun nameOf(event: KClass<out Event>): String {
        val whose = if (PlayerEvent::class.java.isAssignableFrom(event.java)) {
            "player"
        } else {
            streams.single { (stream, _) -> stream.isAssignableFrom(event.java) }.second
        }
        val verb = event.simpleName!!.removePrefix(whose.replaceFirstChar { it.uppercase() })
        return "villages.$whose.${verb.replaceFirstChar { it.lowercase() }}"
    }

    /** The full type, `villages.<whose>.<verb>.v<version>`. */
    fun typeOf(event: KClass<out Event>, version: Int = 1): String = "${nameOf(event)}.v$version"
}
