package villages.application.fate

import villages.application.CharacterById
import villages.application.CharacterRow
import villages.application.DialogueEnding
import villages.application.DialoguesByHouse
import villages.application.HouseById
import villages.application.KeyFiguresByHouse
import villages.application.SightsByHouse
import villages.domain.Omen
import villages.domain.OmenKind

private val CharacterRow.fullName get() = "${name.given} ${name.family}"

/**
 * The inspect windows the page says it has open, as omens: a house its own house has revealed the seat of, and a
 * person it sees today or holds as a key figure. Its own house is an omen of its own, because a player's own window
 * is open most of the time and says nothing about the world. What the page names that the house may not see is
 * dropped, as the fog would drop it. See decision records 0061 and 0083.
 */
class WindowOmens(
    private val houses: HouseById,
    private val characters: CharacterById,
    private val sights: SightsByHouse,
    private val figures: KeyFiguresByHouse,
) : OmenSource {
    override fun read(moment: Moment): List<Omen> {
        val own = moment.house.id
        val sight = sights.of(own)
        val held = figures.of(own).map { it.id }.toSet()
        val onHouses = moment.looking.inspectingHouses.mapNotNull { id ->
            if (id == own) {
                Omen(OmenKeys.INSPECTING_OWN, OmenKind.WINDOW, "Inspecting your own house")
            } else {
                houses.ofHouse(id)
                    ?.takeIf { sight.reveals(it.seat) }
                    ?.let { Omen(OmenKeys.inspectingHouse(id), OmenKind.WINDOW, "Inspecting House ${it.name.value}") }
            }
        }
        val onPeople = moment.looking.inspectingCharacters.mapNotNull { id ->
            characters.ofCharacter(id)
                ?.takeIf { row -> row.id in held || row.place?.let { sight.sees(it, moment.today) } == true }
                ?.let { Omen(OmenKeys.inspectingCharacter(id), OmenKind.WINDOW, "Inspecting ${it.fullName}") }
        }
        return onHouses + onPeople
    }
}

/** The dialogue the page says is being read, if it is one of the house's own and not yet ended. */
class DialogueOmens(private val dialogues: DialoguesByHouse) : OmenSource {
    override fun read(moment: Moment): List<Omen> {
        val id = moment.looking.dialogue ?: return emptyList()
        val row = dialogues.of(moment.house.id).firstOrNull { it.dialogue.id == id } ?: return emptyList()
        return listOfNotNull(
            Omen(OmenKeys.dialogue(id), OmenKind.DIALOGUE, "Unresolved: ${row.dialogue.title}")
                .takeIf { row.ending == DialogueEnding.Open },
        )
    }
}

/** The key figure the page says is open, if they are one of the house's own. */
class FigureOmens(private val figures: KeyFiguresByHouse) : OmenSource {
    override fun read(moment: Moment): List<Omen> {
        val id = moment.looking.figure ?: return emptyList()
        val figure = figures.of(moment.house.id).firstOrNull { it.id == id } ?: return emptyList()
        return listOf(Omen(OmenKeys.figure(id), OmenKind.KEY_FIGURE, figure.fullName))
    }
}

/**
 * Every omen source there is, in the order the report card shows what they read: the house and what changed in it,
 * what the page has open, where it is looking, and the time of year. One list, so the app and every test that rolls read the same omens.
 * A new source is a line here.
 */
@Suppress("LongParameterList")
fun omenSources(
    houses: HouseById,
    characters: CharacterById,
    figures: KeyFiguresByHouse,
    sights: SightsByHouse,
    dialogues: DialoguesByHouse,
    lastRolls: StandingAtLastRoll,
    months: WorldMonths,
    grounds: GroundMaps,
    housesNear: HousesNear,
): List<OmenSource> = listOf(
    HouseOmens(),
    ChangeOmens(lastRolls),
    MissingWealthOmens(dialogues),
    WindowOmens(houses, characters, sights, figures),
    DialogueOmens(dialogues),
    FigureOmens(figures),
    MapOmens(grounds, sights, housesNear),
    SeasonOmens(months),
)
