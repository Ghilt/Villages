package villages.gateway

import villages.domain.WorldTime
import villages.protocol.Cell
import villages.protocol.PROTOCOL_VERSION
import java.time.Instant
import java.util.UUID

/* What the gateway's specs send it, as the page would, and the places and days they stand on. */

internal val noon = Instant.parse("2026-09-04T12:00:00Z")

/** The twenty-fourth of June, year 1246: the world-day every test stands on. */
internal val today = WorldTime(454901)
internal const val TOKEN = "0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"
internal val hello = """{"type":"hello","playerToken":"$TOKEN","protocolVersion":$PROTOCOL_VERSION}"""
internal const val RAVENSCAR = "6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"

/** A command id is a UUID: it becomes the causation of what the command writes. See 0035. */
internal const val COMMAND_ONE = "1c000001-0000-4000-8000-00000000000a"
internal const val COMMAND_TWO = "1c000002-0000-4000-8000-00000000000b"
internal const val COMMAND_THREE = "1c000003-0000-4000-8000-00000000000c"
internal const val COMMAND_FOUR = "1c000004-0000-4000-8000-00000000000d"

/** Stockholm, before the warp, at three depths: the shared vector every zoom of it is known for. */
internal const val STOCKHOLM_Z10 = "1200312213"
internal const val STOCKHOLM_Z8 = "12003122"
internal const val STOCKHOLM_Z4 = "1200"

/** Four hundred kilometres east of Stockholm, and the cell it falls in: far outside a seat there's 34 km. */
internal const val HELSINKI_LAT = 60.17
internal const val HELSINKI_LON = 24.94
internal val HELSINKI_Z10 = Cell.of(HELSINKI_LAT, HELSINKI_LON).quadkey

internal fun founding(
    commandId: String = COMMAND_ONE,
    name: String = "Ravenscar",
    lat: Double = 59.33,
    lon: Double = 18.07,
) =
    """{"type":"command","commandId":"$commandId","command":{"type":"foundHouse",""" +
        """"name":"$name","seat":{"lat":$lat,"lon":$lon},""" +
        """"banner":{"field":"sable","division":"plain","charge":"stag","chargeTincture":"argent"}}}"""

internal fun takingAction(choiceId: String, optionId: String, commandId: String = COMMAND_ONE) =
    """{"type":"command","commandId":"$commandId","command":{"type":"takeAction",""" +
        """"choiceId":"$choiceId","optionId":"$optionId"}}"""

internal fun granting(resource: String = "wealth", amount: Long = 120, commandId: String = COMMAND_TWO) =
    """{"type":"command","commandId":"$commandId","command":{"type":"grantResource",""" +
        """"resource":"$resource","amount":$amount}}"""

internal fun spending(resource: String = "wealth", amount: Long = 50, commandId: String = COMMAND_TWO) =
    """{"type":"command","commandId":"$commandId","command":{"type":"spendResource",""" +
        """"resource":"$resource","amount":$amount}}"""

internal fun pledging(resource: String = "reason", amount: Long = 35, months: Long = 10, commandId: String = COMMAND_TWO) =
    """{"type":"command","commandId":"$commandId","command":{"type":"pledgeResource",""" +
        """"resource":"$resource","amount":$amount,"months":$months,"purpose":"clearer glass"}}"""

internal fun releasing(pledgeId: String, commandId: String = COMMAND_TWO) =
    """{"type":"command","commandId":"$commandId","command":{"type":"releasePledge",""" +
        """"pledgeId":"$pledgeId"}}"""

internal fun subscribe(vararg cells: String) =
    """{"type":"subscribeCells","cells":[${cells.joinToString { "\"$it\"" }}]}"""

internal fun unsubscribe(vararg cells: String) =
    """{"type":"unsubscribeCells","cells":[${cells.joinToString { "\"$it\"" }}]}"""

internal fun seeAll(on: Boolean) = """{"type":"seeAll","on":$on}"""

internal fun fogOfWar(on: Boolean) = """{"type":"fogOfWar","on":$on}"""

internal fun offering(sample: String, commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"offerDialogue","sample":"$sample"}}"""

internal fun stepping(dialogueId: String, lineId: String, commandId: String) =
    """{"type":"command","commandId":"$commandId",""" +
        """"command":{"type":"completeDialogueStep","dialogueId":"$dialogueId","lineId":"$lineId"}}"""

internal fun addingAKeyFigure(commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"addKeyFigure"}}"""

internal fun changingStat(characterId: String, stat: String, by: Int, commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"changeStat",""" +
        """"characterId":"$characterId","stat":"$stat","by":$by}}"""

internal fun killing(characterId: String, commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"killCharacter",""" +
        """"characterId":"$characterId","cause":"struck down from the debug panel"}}"""

internal fun moving(characterId: String, lat: Double, lon: Double, commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"moveCharacter",""" +
        """"characterId":"$characterId","place":{"lat":$lat,"lon":$lon}}}"""

internal fun givingVision(lat: Double, lon: Double, commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"giveVision",""" +
        """"place":{"lat":$lat,"lon":$lon}}}"""

internal fun takingVision(visionId: String, commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"takeVision",""" +
        """"visionId":"$visionId"}}"""

internal fun takingOff(characterId: String, commandId: String) =
    """{"type":"command","commandId":"$commandId","command":{"type":"takeOffTheMap",""" +
        """"characterId":"$characterId"}}"""

/** A command id of its own for every command a test sends, since a key figure's id is worked out from one. */
internal fun commandNumber(n: Int) = "c0000000-0000-4000-8000-%012d".format(n)
