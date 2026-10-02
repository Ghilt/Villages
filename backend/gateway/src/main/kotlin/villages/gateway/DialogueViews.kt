package villages.gateway

import villages.application.DialogueEnding
import villages.application.DialogueRow
import villages.domain.Effect
import villages.domain.Line
import villages.domain.Requirement
import villages.domain.RevealImpact
import villages.domain.Shows
import villages.domain.walk
import villages.protocol.DialogueView
import villages.protocol.EndingView
import villages.protocol.ImpactView
import villages.protocol.LineView
import villages.protocol.Point
import villages.protocol.RequirementView
import villages.protocol.RevealImpactView
import villages.protocol.SaidLineView
import villages.protocol.ShowsView
import villages.protocol.SpeakerView

/**
 * A dialogue as its player may know it, walked from the steps taken: what has been said and what it did, the
 * stretch still to read and the options pending, and nothing past them, and never its requirements. The walk
 * is the decider's own, so the page and the house's rules cannot disagree. See 0071.
 */
internal fun DialogueRow.toView(): DialogueView {
    val walk = dialogue.walk(taken)
    // A dialogue that has ended ends where it stood: a lost one has nothing left to read and nothing to choose.
    val ended = ending != DialogueEnding.Open
    return DialogueView(
        id = dialogue.id.value.toString(),
        revision = revision,
        title = dialogue.title,
        scene = dialogue.scene,
        speakers = dialogue.speakers.map {
            SpeakerView(it.id.value, it.party, it.name, it.portrait, it.character?.value?.toString())
        },
        said = walk.said.map { SaidLineView(it.id.value, it.speaker.value, it.words, it.effects.map(Effect::toView)) },
        next = if (ended) emptyList() else walk.next.map { it.toView() },
        options = if (ended) emptyList() else walk.options.map { it.asOption() },
        ending = when (val stands = ending) {
            DialogueEnding.Open -> EndingView.Open
            DialogueEnding.Completed -> EndingView.Completed
            is DialogueEnding.Lost -> EndingView.Lost(stands.because.toView())
        },
    )
}

/** A line still to be read: the words, who says them and what the line shows, and not what it will give. */
private fun Line.toView(): LineView = LineView(id.value, speaker.value, words, shows = shows?.toView())

/** An option to pick, with how whoever wrote it chose to show what taking it will do, and what it shows. */
private fun Line.asOption(): LineView =
    LineView(id.value, speaker.value, words, revealImpact?.toView(), shows?.toView())

private fun Shows.toView(): ShowsView = when (this) {
    is Shows.Place -> ShowsView.Place(Point(at.lat, at.lon))
    is Shows.House -> ShowsView.House(house.value.toString())
    is Shows.Character -> ShowsView.Character(character.value.toString())
}

private fun RevealImpact.toView(): RevealImpactView = when (this) {
    is RevealImpact.Shown -> RevealImpactView.Shown(impacts.map { ImpactView(it.resource.toWire(), it.amount) })
    RevealImpact.Hidden -> RevealImpactView.Hidden
}

private fun Requirement.toView(): RequirementView = when (this) {
    is Requirement.Alive -> RequirementView.Alive(character.value.toString())
}
