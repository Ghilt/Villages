package villages.gateway

import villages.application.Antarctica
import villages.application.Arrival
import villages.application.CharacterById
import villages.application.CharactersByCell
import villages.application.ChoicesByPlayer
import villages.application.EventFeed
import villages.application.EveryHouse
import villages.application.FoundHouseService
import villages.application.HouseById
import villages.application.HousesByCell
import villages.application.HousesByPlayer
import villages.application.KeyFigureService
import villages.application.KeyFiguresByHouse
import villages.application.RecentEvents
import villages.application.ResourceService
import villages.application.SightsByHouse
import villages.application.Stands
import villages.application.StructureService
import villages.application.StructuresByCell
import villages.application.TakeActionService
import villages.application.VisionService
import villages.application.WorldKept
import villages.application.WorldClock
import villages.application.WorldSaves
import villages.application.WorldWipe
import villages.application.fate.RollService
import villages.application.fate.WaterAt
import villages.application.Shelf
import villages.domain.StructureCatalogue

/**
 * What the gateway's parts are made from: every port a mechanic reads or acts through at the edge. Gathered here so
 * that a new mechanic is a field of this and a line in [partsOf], and the core in `Gateway.kt` does not grow with
 * every one. The read models the core reads itself - the houses and the people in a cell, for its snapshots - stay
 * the gateway's own. See decision record 0075.
 */
class Mechanics(
    val foundHouse: FoundHouseService,
    val events: EventFeed,
    val theirHouses: HousesByPlayer,
    val houseById: HouseById = HouseById { null },
    val arrival: Arrival,
    val takeAction: TakeActionService,
    val rolls: RollService,
    val resources: ResourceService,
    val choices: ChoicesByPlayer,
    val recent: RecentEvents,
    val emptyTheWorld: WorldWipe,
    val keyFigures: KeyFigureService,
    val figures: KeyFiguresByHouse,
    val sights: SightsByHouse,
    val visions: VisionService,
    val stands: Stands = Stands { _, _, _, _ -> null },
    val waters: WaterAt = WaterAt.NOWHERE,
    val structures: StructureService,
    val antarctica: Antarctica,
    val instrumentsOpen: Boolean = true,
    /** Where the world is kept and what of it cannot be read, which hello and the instruments say. */
    val worldKept: WorldKept = WorldKept.IN_MEMORY,

    /** The catalogue, for what a structure's slots are and how many places each has; none shows no slots. */
    val structureCatalogue: () -> StructureCatalogue? = { null },
    /** People by their id, for a person in a slot to be said by name. */
    val characterById: CharacterById = CharacterById { null },
    /** The game server's catalogues, which the inspect pages read and save through; none takes no revisions. 0097. */
    val catalogues: Shelf? = null,
    /** The development world's saves, which the debug panel makes; nowhere keeps none. 0101. */
    val saves: WorldSaves = WorldSaves.NOWHERE,
    /** Every house there is, for the debug panel to switch players by; none lists nobody. 0101. */
    val everyHouse: EveryHouse = EveryHouse { emptyList() },
)

/**
 * A part for each mechanic, in the order a player arriving is told things: the house (100), whom it holds (200), what it
 * holds (300), the structures (400), what it sees (500), what it was told (600), what it set out to do (700), what it is
 * asked (800); then the stands, the waters, the timeline and the windows (0088), which greet nobody; and Adam's
 * instruments (0076). A mechanic that brings its own part, a [GatewayMechanic], says its number itself; the rest stand
 * here until they do. A part watches its read models from the moment it is made, so the gateway makes them after its
 * index and its sessions.
 */
@Suppress("LongParameterList")
internal fun partsOf(
    core: Core,
    mechanics: Mechanics,
    own: List<GatewayMechanic>,
    houses: HousesByCell,
    onTheMap: CharactersByCell,
    structuresOnTheMap: StructuresByCell,
    world: WorldClock,
): List<Part> = with(mechanics) {
    val here = listOf(
        100 to HousesPart(core, houses, theirHouses),
        200 to KeyFiguresPart(core, figures, onTheMap, world),
        300 to HoldingsPart(core, structuresOnTheMap, houseById, SlotsSeen(structureCatalogue, characterById)),
        400 to StructuresPart(core, structuresOnTheMap, world),
        500 to SightPart(core, sights),
        800 to ChoicesPart(core, arrival, takeAction, choices, rolls),
        900 to StandsPart(stands),
        1000 to WatersPart(waters),
        1100 to TimelinePart(),
        1200 to InspectingPart(houseById, onTheMap, structuresOnTheMap, world),
        1300 to Instruments(instrumentsOpen, core, events, recent, emptyTheWorld, foundHouse, resources, keyFigures, visions, rolls, worldKept, structures, antarctica),
        1400 to CataloguesPart(instrumentsOpen, catalogues),
        1500 to SavesPart(instrumentsOpen, core, saves),
        1600 to PlayersPart(instrumentsOpen, everyHouse),
    )
    val made = Made(core, instrumentsOpen, world)
    val all = here + own.map { it.greeting to it.part(made) }
    val shared = all.groupBy { it.first }.filterValues { it.size > 1 }.keys
    require(shared.isEmpty()) { "two parts of the gateway stand at $shared: a mechanic's greeting must be its own" }
    all.sortedBy { it.first }.map { it.second }
}
