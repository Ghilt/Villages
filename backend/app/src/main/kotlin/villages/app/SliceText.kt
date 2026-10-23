package villages.app

import tools.jackson.databind.JsonNode
import villages.domain.Stat
import villages.domain.challenge.Aspect
import villages.domain.challenge.ChallengeSlice
import villages.domain.challenge.StandIn

/**
 * A challenge's slice as a catalogue file writes it, the way the challenges page's draft does: its `aspect` and its
 * `power`, `integrity` and `summonCount`, its `effects` by their ids, and what is `slotted` in their slots, a
 * `keyFigure` with a `name` and `stats` or a `building` with a `name` and a `level`. Strict, as every reader of the
 * shelf is: a field it cannot read refuses, naming where. Read by the quest files, for an opponent's slices, and by
 * the challenge catalogue, for every house's starting slices. See decision record 0107, amended.
 */
internal object SliceText {
    private val ASPECTS = Aspect.entries.associateBy { it.name.lowercase() }
    private val STATS = Stat.entries.associateBy { it.name.lowercase() }

    fun slicesOf(node: JsonNode?, at: String, refuse: (String) -> Nothing): List<ChallengeSlice> {
        if (node == null || !node.isArray) refuse(at)
        return node.values().mapIndexed { index, slice -> sliceOf(slice, "$at[$index]", refuse) }
    }

    fun sliceOf(node: JsonNode, at: String, refuse: (String) -> Nothing): ChallengeSlice {
        if (!node.isObject) refuse(at)
        fun number(field: String) = node[field]?.takeIf { it.isNumber }?.asDouble() ?: refuse("$at.$field")
        val effects = node["effects"]?.takeIf { it.isArray } ?: refuse("$at.effects")
        val slotted = node["slotted"]
        if (slotted != null && !slotted.isObject) refuse("$at.slotted")
        return ChallengeSlice(
            aspect = node["aspect"]?.takeIf { it.isString }?.asString()?.let(ASPECTS::get) ?: refuse("$at.aspect"),
            power = number("power"),
            integrity = number("integrity"),
            summonCount = node["summonCount"]?.takeIf { it.isIntegralNumber }?.asInt() ?: refuse("$at.summonCount"),
            effects = effects.values().map { it.takeIf { one -> one.isString }?.asString() ?: refuse("$at.effects") },
            slotted = slotted?.properties()?.associate { (effect, standIn) -> effect to standInOf(standIn, "$at.slotted.$effect", refuse) }
                ?: emptyMap(),
        )
    }

    private fun standInOf(node: JsonNode, at: String, refuse: (String) -> Nothing): StandIn {
        if (!node.isObject) refuse(at)
        val name = node["name"]?.takeIf { it.isString }?.asString() ?: refuse("$at.name")
        return when (node["kind"]?.takeIf { it.isString }?.asString()) {
            "keyFigure" -> StandIn.KeyFigure(
                name,
                (node["stats"]?.takeIf { it.isObject } ?: refuse("$at.stats")).properties().associate { (stat, value) ->
                    (STATS[stat] ?: refuse("$at.stats.$stat")) to (value.takeIf { it.isIntegralNumber }?.asInt() ?: refuse("$at.stats.$stat"))
                },
            )
            "building" -> StandIn.Building(name, node["level"]?.takeIf { it.isIntegralNumber }?.asInt() ?: refuse("$at.level"))
            else -> refuse("$at.kind")
        }
    }
}
