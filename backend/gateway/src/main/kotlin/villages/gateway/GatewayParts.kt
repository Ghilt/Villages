package villages.gateway

import villages.application.Antarctica
import villages.application.CharacterById
import villages.application.CharactersByCell
import villages.application.EventFeed
import villages.application.EveryHouse
import villages.application.HouseById
import villages.application.HousesByCell
import villages.application.RecentEvents
import villages.application.SignedIn
import villages.application.Stands
import villages.application.StructuresByCell
import villages.application.WorldKept
import villages.application.WorldClock
import villages.application.WorldSaves
import villages.application.WorldWipe
import villages.application.fate.WaterAt
import villages.application.Shelf
import villages.domain.StructureCatalogue
import villages.protocol.SettlementsNow

/**
 * What the gateway's own parts are made from, and what its core reads besides its read models: the chronicle and the
 * wipe, the stands and the waters, the windows, Antarctica and the slots for the fog and the snapshots, and what the
 * instruments and the inspect pages read. A mechanic's ports are not here: a mechanic hands the gateway its own part, a
 * [GatewayMechanic]. See decision record 0075 and `docs/plans/mechanic-modules.md`, step 6.
 */
class Mechanics(
    val events: EventFeed,
    val houseById: HouseById = HouseById { null },
    val recent: RecentEvents,
    val emptyTheWorld: WorldWipe,
    val stands: Stands = Stands { _, _, _, _ -> null },
    val waters: WaterAt = WaterAt.NOWHERE,
    val antarctica: Antarctica,
    val instrumentsOpen: Boolean = true,
    /**
     * Which windows the open instruments are open to, by the sign-in each was opened with, when only some: the accounts
     * of the emails `villages.instruments.for` names. None, and they are open to every window. See [instrumentsOf].
     */
    val instrumentsFor: ((SignedIn?) -> Boolean)? = null,
    /** Where the world is kept and what of it cannot be read, which hello and the instruments say. */
    val worldKept: WorldKept = WorldKept.IN_MEMORY,
    /** The world's settlements counted, which hello says while the instruments are open; none for a world without. */
    val settlements: () -> SettlementsNow? = { null },

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
 * asked (800), each a mechanic's own [GatewayMechanic], which says its number itself; then the stands (900), the waters
 * (1000), the timeline (1100) and the windows (1200, 0088), which greet nobody and are the gateway's own; and Adam's
 * instruments (1300, 0076) and what the inspect pages read through them. A mechanic with levers only stands among
 * these, as the resources do at 1250. A part watches its read models from the moment it is made, so the gateway makes them after its
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
        900 to StandsPart(stands),
        1000 to WatersPart(waters),
        1100 to TimelinePart(),
        1200 to InspectingPart(houseById, onTheMap, structuresOnTheMap, world),
        1300 to Instruments(instrumentsOpen, core, events, recent, emptyTheWorld, worldKept),
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
