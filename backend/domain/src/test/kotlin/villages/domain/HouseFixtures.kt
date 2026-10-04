package villages.domain

import io.kotest.matchers.types.shouldBeInstanceOf
import java.time.Instant
import java.util.UUID

/*
 * The house the house specs stand on: its founding, its choices, its resources and its dialogues, each made of
 * the ones before it. See the HouseSpecs beside it.
 */

internal val noon = Instant.parse("2026-09-04T12:00:00Z")
internal val house = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"))
internal val player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
internal val day = WorldTime(454901)
internal val sable = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT)
internal val or = Banner(Tincture.OR, Division.PLAIN, null, Charge.TOWER, Tincture.GULES)

internal val ravenscar = FoundHouse(
    houseId = house,
    player = player,
    name = HouseName("Ravenscar"),
    seat = Location(59.33, 18.07),
    banner = sable,
    worldTime = day,
    recordedAt = noon,
)

internal val northern = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000001"))
internal val southern = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000002"))
internal val whereToSettle = Choice(
    id = ChoiceId(UUID.fromString("aa000000-0000-4000-8000-00000000c401")),
    prompt = "Where shall the house raise its seat?",
    options = listOf(
        Option(northern, "Ravenscar", "On the northern shore.", Effect.FoundAt(Location(59.33, 18.07), HouseName("Ravenscar"), sable)),
        Option(southern, "Hollin", "Under the southern hills.", Effect.FoundAt(Location(47.5, 19.05), HouseName("Hollin"), or)),
    ),
)
internal val giving = GiveChoice(house, player, whereToSettle, day, noon)
internal fun taking(choice: ChoiceId = whereToSettle.id, option: OptionId = southern) =
    TakeAction(house, player, choice, option, day, noon)

// ---- resources -------------------------------------------------------------------------------

/** A house founded and its founding wealth spent, so that the resource specs count from nothing. */
internal val standing = HouseDecider.fold(HouseDecider.decide(ravenscar, HouseDecider.initial)).let { founded ->
    HouseDecider.decide(SpendResource(house, Resource.WEALTH, FOUNDING_WEALTH, day, noon), founded)
        .fold(founded, HouseDecider::evolve)
}
internal val glass = PledgeId(UUID.fromString("bb000000-0000-4000-8000-00000000d101"))
internal val later = WorldTime(455205)

internal fun granting(resource: Resource = Resource.WEALTH, amount: Long = 120) =
    GrantResource(house, resource, amount, day, noon)

internal fun spending(resource: Resource = Resource.WEALTH, amount: Long = 50) =
    SpendResource(house, resource, amount, day, noon)

internal fun pledging(amount: Long = 35, id: PledgeId = glass, until: WorldTime = later) =
    PledgeResource(house, id, Resource.REASON, amount, until, "the making of clearer glass", day, noon)

/** The house after everything these commands did to it, in order. */
internal fun after(vararg commands: HouseCommand): House.Founded =
    commands.fold(standing) { state, command ->
        HouseDecider.decide(command, state).fold(state, HouseDecider::evolve)
    }.shouldBeInstanceOf<House.Founded>()

internal fun figure(n: Int) = CharacterId(UUID.fromString("cc000000-0000-4000-8000-%012d".format(n)))
internal fun founded(): House = HouseDecider.fold(HouseDecider.decide(ravenscar, HouseDecider.initial))
internal fun takeIn(house: House, n: Int): House =
    HouseDecider.decide(TakeKeyFigure(ravenscar.houseId, figure(n), day, noon), house).fold(house, HouseDecider::evolve)
internal fun holding(count: Int): House = (1..count).fold(founded(), ::takeIn)

/** Acting through: the house's own history decides whose key figure a character is, and nothing is written. */

internal fun vision(n: Int) = VisionId(UUID.fromString("dd000000-0000-4000-8000-%012d".format(n)))
internal val gotland = Location(57.64, 18.30)
internal fun give(house: House, n: Int): House =
    HouseDecider.decide(GiveVision(ravenscar.houseId, vision(n), gotland, day, noon), house).fold(house, HouseDecider::evolve)

// ---- a choice that grants --------------------------------------------------------------------

internal val purse = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000011"))
internal val letters = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000012"))
internal val aGift = Choice(
    id = ChoiceId(UUID.fromString("aa000000-0000-4000-8000-00000000c402")),
    prompt = "A traveller from the south offers the house a gift.",
    options = listOf(
        Option(purse, "The purse", "A hundred in coin.", Effect.Grant(Resource.WEALTH, 100)),
        Option(letters, "The letters", "Introductions at court.", Effect.Grant(Resource.INFLUENCE, 20)),
    ),
)

// ---- dialogues -------------------------------------------------------------------------------

internal val messenger = Speaker(SpeakerId("messenger"), party = 1, name = "A messenger", portrait = null, character = null)
internal val offeredBy = UUID.fromString("1c000007-0000-4000-8000-000000000020")

internal fun letter(command: UUID = offeredBy) = Dialogue(
    id = DialogueId.offered(house, command),
    title = "A letter from the coast",
    scene = null,
    speakers = listOf(messenger),
    lines = listOf(Line(LineId("news"), messenger.id, "The harbour is ours, my lord.", then = Then.End)),
)

internal fun offering(dialogue: Dialogue = letter()) = OfferDialogue(house, dialogue, day, noon)

// ---- steps through a dialogue ----------------------------------------------------------------

internal val lady = Speaker(SpeakerId("agnes"), party = 0, name = "Agnes Hollin", portrait = null, character = null)
internal val coin = Effect.Grant(Resource.WEALTH, 100)

internal fun said(id: String, then: Then, by: Speaker = messenger, effects: List<Effect> = emptyList()) =
    Line(LineId(id), by.id, "The words of $id.", effects, then = then)

// The messenger asks, and either answer pays: one before the messenger's thanks end it, one as it ends it.
internal val quay = Dialogue(
    id = DialogueId.offered(house, UUID.fromString("1c000007-0000-4000-8000-000000000030")),
    title = "A new quay",
    scene = null,
    speakers = listOf(lady, messenger),
    lines = listOf(
        said("arrives", Then.Say(LineId("asks"))),
        said("asks", Then.DialogueChoice(listOf(LineId("accept"), LineId("refuse")))),
        said("accept", Then.Say(LineId("thanks")), by = lady, effects = listOf(coin)),
        said("refuse", Then.End, by = lady, effects = listOf(Effect.Grant(Resource.INFLUENCE, 5))),
        said("thanks", Then.End),
    ),
)
internal val talking = after(offering(quay))

internal fun stepping(line: String, dialogue: DialogueId = quay.id) =
    CompleteDialogueStep(house, dialogue, LineId(line), day, noon)

// ---- a requirement failing ----------------------------------------------------------------------

internal val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))
internal val her = Speaker(SpeakerId("agnes"), party = 0, name = "Agnes Hollin", portrait = null, character = agnes)

internal fun spokenBy(speaker: Speaker, command: String) = Dialogue(
    id = DialogueId.offered(house, UUID.fromString(command)),
    title = "Spoken by ${speaker.name}",
    scene = null,
    speakers = listOf(speaker, messenger).distinct(),
    lines = listOf(Line(LineId("only"), speaker.id, "A word.", then = Then.End)),
)
internal val herFirst = spokenBy(her, "1c000007-0000-4000-8000-000000000050")
internal val herSecond = spokenBy(her, "1c000007-0000-4000-8000-000000000051")
internal val theMessengers = spokenBy(messenger, "1c000007-0000-4000-8000-000000000052")
internal val herDeath = FailRequirement(house, Requirement.Alive(agnes), day, noon)
