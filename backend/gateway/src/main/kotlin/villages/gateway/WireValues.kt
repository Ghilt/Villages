package villages.gateway

import villages.domain.Resource
import villages.domain.Stat
import villages.protocol.Cell

internal fun isCell(candidate: String): Boolean = runCatching { Cell(candidate) }.isSuccess

/** A resource named on the wire, or the refusal. The wire's names are the code's; see 0053 and the naming rule. */
internal fun asResource(name: String): Resource =
    Resource.entries.firstOrNull { it.toWire() == name }
        ?: throw IllegalArgumentException("not a resource: $name")

/** An identifier off the wire, or a refusal saying which one was not one. */
internal fun asUuid(value: String, what: String): java.util.UUID =
    runCatching { java.util.UUID.fromString(value) }
        .getOrElse { throw IllegalArgumentException("$what is a UUID, not $value") }

/** A stat named on the wire, which is its name in lower case, or the refusal. */
internal fun asStat(name: String): Stat =
    Stat.entries.firstOrNull { it.name.lowercase() == name }
        ?: throw IllegalArgumentException("not a stat: $name")

/**
 * A resource's name on the wire: the code's name and not the player's, because the wire is code talking
 * to code and what a player is shown is the interface's to decide. Exhaustive, so a sixth resource cannot
 * reach the wire without somebody naming it. See the naming rule in `BUILDING-A-MECHANIC.md`.
 */
internal fun Resource.toWire(): String = when (this) {
    Resource.WEALTH -> "wealth"
    Resource.NATURAL_DOMAIN -> "naturalDomain"
    Resource.INFLUENCE -> "influence"
    Resource.REASON -> "reason"
    Resource.PIETY -> "piety"
}
