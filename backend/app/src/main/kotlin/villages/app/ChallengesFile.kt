package villages.app

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import villages.domain.Stat
import villages.domain.challenge.Aspect
import villages.domain.challenge.Bearer
import villages.domain.challenge.ChallengeCatalogue
import villages.domain.challenge.ChallengeEffect
import villages.domain.challenge.ChallengeKind
import villages.domain.challenge.ChallengeSlot
import villages.domain.challenge.Fires
import villages.domain.challenge.Fits
import villages.domain.challenge.Lasting
import villages.domain.challenge.SummonSpec

/**
 * `world/catalogues/challenges.json` read into what the challenge's rules read: strict, so a field it cannot read
 * refuses the whole file, naming where, and a field beginning `$` is passed over. The names and the words are the
 * page's, and are only checked to be there. The shape is a contract, held by `contracts/fixtures/challenges.json`,
 * which the world package's `parseChallenges` reads too. See decision records 0097 and 0107.
 */
object ChallengesFile {
    private val json = JsonMapper.builder().build()

    private val ASPECTS = Aspect.entries.associateBy { it.name.lowercase() }
    private val STATS = Stat.entries.associateBy { it.name.lowercase() }
    private val FIRES = Fires.entries.associateBy { it.name.lowercase() }
    private val FITS = mapOf("keyFigure" to Fits.KEY_FIGURE, "structure" to Fits.STRUCTURE)
    private val BEARERS = Bearer.entries.associateBy { it.name.lowercase() }

    fun parse(text: String): ChallengeCatalogue {
        val root = json.readTree(text)
        val effects = section(root, "effects").flatMap { (aspectName, effects) ->
            val aspect = ASPECTS[aspectName] ?: refuse("effects.$aspectName, an aspect,")
            if (!effects.isObject) refuse("effects.$aspectName")
            fields(effects).map { (name, node) -> effectOf("$aspectName.$name", aspect, node) }
        }
        val summons = section(root, "summons").associate { (id, node) -> id to summonOf(id, node) }
        val buffs = section(root, "buffs").associate { (id, node) -> id to lastingOf("buffs.$id", node) }
        val debuffs = section(root, "debuffs").associate { (id, node) -> id to lastingOf("debuffs.$id", node) }
        val kinds = section(root, "kinds").associate { (id, node) -> id to kindOf(id, node) }
        return checked("effects") { ChallengeCatalogue(effects, summons, kinds, buffs, debuffs) }
    }

    private fun effectOf(id: String, aspect: Aspect, node: JsonNode): ChallengeEffect {
        val at = "effects.$id"
        if (!node.isObject) refuse(at)
        word(node, "name", at)
        word(node, "words", at)
        return checked(at) {
            ChallengeEffect(
                id = id,
                aspect = aspect,
                fires = node["fires"]?.takeIf { it.isString }?.asString()?.let(FIRES::get) ?: refuse("$at.fires"),
                numbers = numbers(node["numbers"], "$at.numbers"),
                summons = node["summons"]?.let { it.takeIf { summon -> summon.isString }?.asString() ?: refuse("$at.summons") },
                slot = node["slot"]?.let { slotOf(it, "$at.slot") },
                matching = flag(node, "matching", at),
                puts = node["puts"]?.let { it.takeIf { lasting -> lasting.isString }?.asString() ?: refuse("$at.puts") },
            )
        }
    }

    /** [node]'s [name], true or false, and false when it is not there. */
    private fun flag(node: JsonNode, name: String, at: String): Boolean =
        node[name]?.let { it.takeIf { flag -> flag.isBoolean }?.asBoolean() ?: refuse("$at.$name") } ?: false

    private fun slotOf(node: JsonNode, at: String): ChallengeSlot {
        if (!node.isObject) refuse(at)
        return ChallengeSlot(
            fits = node["fits"]?.takeIf { it.isString }?.asString()?.let(FITS::get) ?: refuse("$at.fits"),
            lends = node["lends"]?.let { it.takeIf { stat -> stat.isString }?.asString()?.let(STATS::get) ?: refuse("$at.lends") },
            onTheLine = node["onTheLine"]?.let { it.takeIf { flag -> flag.isBoolean }?.asBoolean() ?: refuse("$at.onTheLine") } ?: false,
        )
    }

    private fun summonOf(id: String, node: JsonNode): SummonSpec {
        val at = "summons.$id"
        if (!node.isObject) refuse(at)
        word(node, "name", at)
        word(node, "words", at)
        val aspect = node["aspect"]?.takeIf { it.isString }?.asString()?.let(ASPECTS::get) ?: refuse("$at.aspect")
        val puts = node["puts"]?.let { it.takeIf { lasting -> lasting.isString }?.asString() ?: refuse("$at.puts") }
        return checked(at) { SummonSpec(aspect, numbers(node["numbers"], "$at.numbers"), flag(node, "matching", at), puts) }
    }

    private fun lastingOf(at: String, node: JsonNode): Lasting {
        if (!node.isObject) refuse(at)
        word(node, "name", at)
        word(node, "words", at)
        val on = node["on"]?.takeIf { it.isString }?.asString()?.let(BEARERS::get) ?: refuse("$at.on")
        return checked(at) { Lasting(on, numbers(node["numbers"], "$at.numbers")) }
    }

    private fun kindOf(id: String, node: JsonNode): ChallengeKind {
        val at = "kinds.$id"
        if (!node.isObject) refuse(at)
        word(node, "name", at)
        word(node, "words", at)
        val weights = node["weights"]?.takeIf { it.isObject } ?: refuse("$at.weights")
        return checked(at) {
            ChallengeKind(
                seconds = range(node["seconds"], "$at.seconds"),
                happenings = range(node["happenings"], "$at.happenings"),
                twoAspects = node["twoAspects"]?.takeIf { it.isNumber }?.asDouble() ?: refuse("$at.twoAspects"),
                weights = fields(weights).associate { (name, weight) ->
                    (ASPECTS[name] ?: refuse("$at.weights.$name, an aspect,")) to
                        (weight.takeIf { it.isNumber }?.asDouble() ?: refuse("$at.weights.$name"))
                },
            )
        }
    }

    /** `[least, most]`, two whole numbers. */
    private fun range(node: JsonNode?, at: String): IntRange {
        val list = node?.takeIf { it.isArray && it.size() == 2 }?.values()?.toList() ?: refuse(at)
        val (least, most) = list.map { it.takeIf { number -> number.isIntegralNumber }?.asInt() ?: refuse(at) }
        return least..most
    }

    private fun numbers(node: JsonNode?, at: String): Map<String, Double> {
        if (node == null) return emptyMap()
        if (!node.isObject) refuse(at)
        return fields(node).associate { (name, value) -> name to (value.takeIf { it.isNumber }?.asDouble() ?: refuse("$at.$name")) }
    }

    /** A section of the file, its fields without the `$` ones. */
    private fun section(root: JsonNode, name: String): List<Pair<String, JsonNode>> =
        fields(root[name]?.takeIf { it.isObject } ?: refuse(name))

    /** An object's fields, leaving out what begins `$`, which says what the rest are. */
    private fun fields(node: JsonNode): List<Pair<String, JsonNode>> =
        node.properties().filter { !it.key.startsWith("$") }.map { it.key to it.value }

    private fun word(node: JsonNode, field: String, at: String): String =
        node[field]?.takeIf { it.isString }?.asString()?.takeIf { it.isNotBlank() } ?: refuse("$at.$field")

    /** What [make] makes, or the rule it broke said with where: `kinds.battle: never more happenings than ...`. */
    private fun <T> checked(at: String, make: () -> T): T = try {
        make()
    } catch (broken: IllegalArgumentException) {
        if (broken.message?.startsWith(FILE) == true) throw broken
        throw IllegalArgumentException("$FILE: $at: ${broken.message}")
    }

    private const val FILE = "world/catalogues/challenges.json"

    private fun refuse(at: String): Nothing = throw IllegalArgumentException("$FILE: no $at the server can read")
}
