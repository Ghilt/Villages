package villages.gateway

import villages.application.Antarctica
import villages.application.Arrival
import villages.application.CharacterById
import villages.application.CharactersByCell
import villages.application.ChoicesByPlayer
import villages.application.DialogueService
import villages.application.DialoguesByHouse
import villages.application.EventFeed
import villages.application.FoundHouseService
import villages.application.HouseById
import villages.application.HousesByCell
import villages.application.HousesByPlayer
import villages.application.KeyFigureService
import villages.application.KeyFiguresByHouse
import villages.application.QuestService
import villages.application.QuestsByHouse
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
    val dialogues: DialogueService,
    val dialogueRows: DialoguesByHouse,
    val quests: QuestService,
    val questRows: QuestsByHouse,
    val stands: Stands = Stands { _, _, _ -> null },
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
)

/**
 * A part for each mechanic, in the order a player arriving is told things: the house, whom it holds, what it holds, what it sees,
 * what it was told, what it set out to do, what it is asked; then the stands, the waters, the timeline and the windows (0088), which greet
 * nobody; and Adam's instruments (0076). A part watches its read models from the moment it is made, so the gateway
 * makes them after its index and its sessions.
 */
internal fun partsOf(
    core: Core,
    mechanics: Mechanics,
    houses: HousesByCell,
    onTheMap: CharactersByCell,
    structuresOnTheMap: StructuresByCell,
    world: WorldClock,
): List<Part> = with(mechanics) {
    listOf(
        HousesPart(core, houses, theirHouses),
        KeyFiguresPart(core, figures, onTheMap, world),
        HoldingsPart(core, structuresOnTheMap, houseById, SlotsSeen(structureCatalogue, characterById)),
        StructuresPart(core, structuresOnTheMap, world),
        SightPart(core, sights),
        DialoguesPart(core, dialogues, dialogueRows),
        QuestsPart(core, quests, questRows),
        ChoicesPart(core, arrival, takeAction, choices, rolls),
        StandsPart(stands),
        WatersPart(waters),
        TimelinePart(),
        InspectingPart(houseById, onTheMap, structuresOnTheMap, world),
        Instruments(instrumentsOpen, core, events, recent, emptyTheWorld, foundHouse, resources, keyFigures, visions, dialogues, rolls, worldKept, structures, antarctica, quests),
        CataloguesPart(instrumentsOpen, catalogues),
        SavesPart(instrumentsOpen, saves),
    )
}
