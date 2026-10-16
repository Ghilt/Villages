package villages.application

import villages.domain.CharacterId
import villages.domain.CharacterName
import villages.domain.Dialogue
import villages.domain.DialogueId
import villages.domain.Effect
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.Line
import villages.domain.LineId
import villages.domain.Location
import villages.domain.RevealImpact
import villages.domain.Shows
import villages.domain.Speaker
import villages.domain.SpeakerId
import villages.domain.Then
import java.util.UUID

/**
 * A dialogue as `world/catalogues/dialogues/<name>.json` writes it: everything a [Dialogue] is but its id, and in place
 * of the people and places of one house, roles filled in when it is offered - a speaker who is the house's key
 * figure, `{given}` in a line for that figure's given name, a line that shows the house's seat, the house itself or
 * the figure. Its ids are words, so one written by hand reads. See decision record 0097.
 */
data class DialogueTemplate(
    val title: String,
    val scene: String?,
    val speakers: List<SpeakerTemplate>,
    val lines: List<LineTemplate>,
) {
    /** A speaker: a person of the dialogue's own, named, or the house's key figure, whoever that is when it is offered. */
    data class SpeakerTemplate(val id: String, val party: Int, val who: Who)

    sealed interface Who {
        data class Named(val name: String, val portrait: String?) : Who

        data object KeyFigure : Who
    }

    data class LineTemplate(
        val id: String,
        val by: String,
        val says: String,
        val effects: List<Effect>,
        val then: Then,
        val revealImpact: RevealImpact?,
        val shows: ShowsWhat?,
    )

    /** What a line shows: the house's seat, the house, or its key figure, as whoever they are when it is offered. */
    enum class ShowsWhat { SEAT, HOUSE, KEY_FIGURE }

    /** Whether it is spoken by, about or to the house's key figure, so a house with none cannot be offered it. */
    val needsKeyFigure: Boolean
        get() = speakers.any { it.who == Who.KeyFigure } || lines.any { GIVEN in it.says || it.shows == ShowsWhat.KEY_FIGURE }

    /** Who the roles are when it is offered: the house, its seat if it holds one, and its key figure if it needs one. */
    data class Filling(val house: HouseId, val seat: Location?, val figure: Figure?)

    /** The key figure, as much of them as a dialogue says: their name, their portrait, who they are. */
    data class Figure(val id: CharacterId, val name: CharacterName, val portrait: String?)

    /**
     * This dialogue, offered under [id], its roles filled by [filling]: the dialogue the domain checks when it is
     * made, refusing it as `InvalidDialogue` when it does not hold together.
     */
    fun offered(id: DialogueId, filling: Filling): Dialogue {
        val figure = filling.figure
        if (needsKeyFigure && figure == null) throw HouseError.NoSuchKeyFigure
        return Dialogue(
            id = id,
            title = title,
            scene = scene,
            speakers = speakers.map { speaker ->
                when (val who = speaker.who) {
                    is Who.Named -> Speaker(SpeakerId(speaker.id), speaker.party, who.name, who.portrait, character = null)
                    Who.KeyFigure -> Speaker(
                        SpeakerId(speaker.id), speaker.party, "${figure!!.name.given} ${figure.name.family}", figure.portrait, figure.id,
                    )
                }
            },
            lines = lines.map { line ->
                Line(
                    id = LineId(line.id),
                    speaker = SpeakerId(line.by),
                    words = figure?.let { line.says.replace(GIVEN, it.name.given) } ?: line.says,
                    effects = line.effects,
                    then = line.then,
                    revealImpact = line.revealImpact,
                    shows = when (line.shows) {
                        null -> null
                        ShowsWhat.SEAT -> filling.seat?.let(Shows::Place)
                        ShowsWhat.HOUSE -> Shows.House(filling.house)
                        ShowsWhat.KEY_FIGURE -> Shows.Character(figure!!.id)
                    },
                )
            },
        )
    }

    /**
     * Whether it holds together, as the shelf asks before taking it on: offered to a stand-in house with a seat and a
     * key figure, the domain's own checks run - every line said by somebody speaking, every path ending, only an
     * option spending. Throws [CatalogueRefused] naming the file and why.
     */
    fun check(name: String): DialogueTemplate {
        try {
            offered(DialogueId(UUID(0, 0)), STAND_IN)
        } catch (wrong: HouseError) {
            throw CatalogueRefused("${Catalogues.DIALOGUES}/$name", wrong.message ?: "it does not hold together")
        } catch (wrong: IllegalArgumentException) {
            throw CatalogueRefused("${Catalogues.DIALOGUES}/$name", wrong.message ?: "it does not hold together")
        }
        return this
    }

    companion object {
        /** Where a line says the key figure's given name. */
        const val GIVEN = "{given}"

        private val STAND_IN = Filling(
            house = HouseId(UUID(0, 1)),
            seat = Location(0.0, 0.0),
            figure = Figure(CharacterId(UUID(0, 2)), CharacterName("Anne", "Ashby"), portrait = null),
        )
    }
}
