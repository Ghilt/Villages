package villages.app

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import villages.application.CharacterNames

/**
 * `world/catalogues/character-names.json` read into the names a newcomer can be given: strict, so a list it cannot read
 * refuses the whole file, naming where. Whether each is a name a character can have is the shelf's check. The shape
 * is a contract, held by `contracts/fixtures/character-names.json`, which the world package reads too. See 0097.
 */
object CharacterNamesFile {
    private val json = JsonMapper.builder().build()

    fun parse(text: String): CharacterNames {
        val root = json.readTree(text)
        val given = root["given"]?.takeIf { it.isObject } ?: refuse("given")
        return CharacterNames(
            women = names(given["woman"], "given.woman"),
            men = names(given["man"], "given.man"),
            family = names(root["family"], "family"),
        )
    }

    private fun names(node: JsonNode?, at: String): List<String> {
        val list = node?.takeIf { it.isArray } ?: refuse(at)
        return list.values().map { it.takeIf { name -> name.isString }?.asString() ?: refuse(at) }
    }

    private fun refuse(at: String): Nothing =
        throw IllegalArgumentException("world/catalogues/character-names.json: no $at the server can read")
}
