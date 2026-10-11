package villages.occurrent

import villages.domain.Banner
import villages.domain.CharacterAged
import villages.domain.CharacterAppeared
import villages.domain.CharacterDied
import villages.domain.CharacterId
import villages.domain.CharacterName
import villages.domain.CharacterLeftTheMap
import villages.domain.CharacterMoved
import villages.domain.CharacterPortraitChanged
import villages.domain.CharacterStatChanged
import villages.domain.Charge
import villages.domain.Choice
import villages.domain.ChoiceId
import villages.domain.Dialogue
import villages.domain.DialogueId
import villages.domain.Division
import villages.domain.Effect
import villages.domain.Event
import villages.domain.HouseFounded
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseGainedVision
import villages.domain.HouseLostKeyFigure
import villages.domain.HouseLostVision
import villages.domain.HouseLostSeat
import villages.domain.HouseNamedSeat
import villages.domain.Resource
import villages.domain.PledgeId
import villages.domain.HouseResourceSpent
import villages.domain.HouseResourceReleased
import villages.domain.HouseIncomeChanged
import villages.domain.IncomeSource
import villages.domain.HouseResourcePledged
import villages.domain.HouseResourceGranted
import villages.domain.PlayerGivenChoice
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Impact
import villages.domain.Omen
import villages.domain.OmenKey
import villages.domain.OmenKind
import villages.domain.PlayerRolled
import villages.domain.PlayerTookAction
import villages.domain.Rarity
import villages.domain.RollId
import villages.domain.Line
import villages.domain.LineId
import villages.domain.Location
import villages.domain.Option
import villages.domain.OptionId
import villages.domain.PlayerId
import villages.domain.PlayerLostDialogue
import villages.domain.PlayerCompletedDialogue
import villages.domain.PlayerCompletedDialogueStep
import villages.domain.PlayerOfferedDialogue
import villages.domain.Requirement
import villages.domain.RevealImpact
import villages.domain.Sex
import villages.domain.Shows
import villages.domain.Significance
import villages.domain.Speaker
import villages.domain.SpeakerId
import villages.domain.Species
import villages.domain.Stat
import villages.domain.StructureId
import villages.domain.StructureChangedHands
import villages.domain.StructureLevelChanged
import villages.domain.StructureSlotEmptied
import villages.domain.StructureSlotFilled
import villages.domain.Content
import villages.domain.ContentId
import villages.domain.StructureRebuilt
import villages.domain.StructureRuined
import villages.domain.StructureRaised
import villages.domain.StructureType
import villages.domain.Then
import villages.domain.Tincture
import villages.domain.VisionId
import villages.domain.emptyStocks
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID

/**
 * One event of every catalogued type, as the store is held to write it: what `EventFormatSpec` pins to the
 * fixtures in contracts/fixtures/events. Kept apart from the spec so that a new type adds a sample here
 * without growing the checks.
 */
internal object EventSamples {
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val house = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a"))
    val player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val day = WorldTime(454901)

    val ravenscar = HouseFounded(
        houseId = house,
        player = player,
        name = HouseName("Ravenscar"),
        seat = Location(59.33, 18.07),
        significance = Significance(20.0),
        banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
        resources = emptyStocks(noon),
        worldTime = day,
        recordedAt = noon,
    )

    val choiceId = ChoiceId(UUID.fromString("aa000000-0000-4000-8000-00000000c401"))
    val northern = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000001"))
    val southern = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000002"))

    val whereToSettle = PlayerGivenChoice(
        houseId = house,
        player = player,
        choice = Choice(
            id = choiceId,
            prompt = "Where shall the house raise its seat?",
            options = listOf(
                Option(
                    id = northern,
                    label = "Ravenscar, on the northern shore",
                    detail = "Cold water, long winters, and nobody near enough to argue with.",
                    effect = Effect.FoundAt(
                        seat = Location(59.33, 18.07),
                        name = HouseName("Ravenscar"),
                        banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
                    ),
                ),
                Option(
                    id = OptionId(UUID.fromString("aa000000-0000-4000-8000-000000000003")),
                    label = "Hear the news first",
                    detail = "A servant has word of the neighbours.",
                    effect = Effect.Converse(
                        Dialogue(
                            id = DialogueId(UUID.fromString("dd000000-0000-4000-8000-00000000a002")),
                            title = "Word of the neighbours",
                            scene = null,
                            speakers = listOf(Speaker(SpeakerId("servant"), 1, "A servant", null, null)),
                            lines = listOf(Line(LineId("says"), SpeakerId("servant"), "They say Varga is broke.", then = Then.End)),
                        ),
                    ),
                ),
                Option(
                    id = southern,
                    label = "Hollin, under the southern hills",
                    detail = "Warm ground and old roads, and neighbours on every one of them.",
                    effect = Effect.FoundAt(
                        seat = Location(47.5, 19.05),
                        name = HouseName("Hollin"),
                        banner = Banner(Tincture.OR, Division.PLAIN, null, Charge.TOWER, Tincture.GULES),
                    ),
                ),
            ),
        ),
        worldTime = day,
        recordedAt = noon,
    )

    val rolledARiver = PlayerRolled(
        houseId = house,
        player = player,
        rollId = RollId(UUID.fromString("dd000000-0000-4000-8000-0000000a0001")),
        omens = listOf(
            Omen(OmenKey("house.pious"), OmenKind.HOUSE, "Pious", 104),
            Omen(OmenKey("map.river"), OmenKind.MAP, "River"),
        ),
        rarity = Rarity.RARE,
        worldTime = day,
        recordedAt = noon,
    )

    val tookNorthern = PlayerTookAction(
        houseId = house,
        player = player,
        choiceId = choiceId,
        optionId = northern,
        worldTime = day,
        recordedAt = noon,
    )

    /** One event of every catalogued type, each pinned to the fixture of that name. */
    val pledgeId = PledgeId(UUID.fromString("bb000000-0000-4000-8000-00000000d101"))

    val givenGold = HouseResourceGranted(
        houseId = house,
        resource = Resource.WEALTH,
        amount = 120,
        worldTime = day,
        recordedAt = noon,
    )

    val spentGold = HouseResourceSpent(
        houseId = house,
        resource = Resource.WEALTH,
        amount = 50,
        worldTime = day,
        recordedAt = noon,
    )

    val pledgedReason = HouseResourcePledged(
        houseId = house,
        pledgeId = pledgeId,
        resource = Resource.REASON,
        amount = 35,
        until = WorldTime(455205),
        purpose = "the making of clearer glass",
        worldTime = day,
        recordedAt = noon,
    )

    val releasedReason = HouseResourceReleased(
        houseId = house,
        pledgeId = pledgeId,
        worldTime = WorldTime(455205),
        recordedAt = noon,
    )

    /** The Antarctic castle paying the house domain, a little over three a world month. */
    val paidByTheCastle = HouseIncomeChanged(
        houseId = house,
        source = IncomeSource("structure:95ba5c28-4a79-3fa6-88aa-0ff1f5a0a559"),
        ratesPerSecond = mapOf(Resource.NATURAL_DOMAIN to 0.00004),
        worldTime = WorldTime(653_706),
        recordedAt = noon,
    )

    val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))
    val agnesAppeared = CharacterAppeared(
        characterId = agnes,
        name = CharacterName("Agnes", "Hollin"),
        sex = Sex.WOMAN,
        species = Species.PERSON,
        bornOn = WorldTime(642_700),
        stats = mapOf(Stat.PIETY to 13, Stat.REASON to 9, Stat.KINDNESS to 11, Stat.PHYSICAL to 7),
        portrait = "woman-03",
        worldTime = WorldTime(653_705),
        recordedAt = noon,
    )
    val agnesDied = CharacterDied(agnes, "a fever that did not break", WorldTime(653_705), noon)

    val tookAgnesIn = HouseGainedKeyFigure(house, agnes, day, noon)
    val lostAgnes = HouseLostKeyFigure(house, agnes, day, noon)
    val agnesAged = CharacterAged(agnes, 10, WorldTime(653_705), noon)
    val agnesRedrawn = CharacterPortraitChanged(agnes, "woman-04", WorldTime(653_705), noon)
    val agnesPiety = CharacterStatChanged(agnes, Stat.PIETY, 15, WorldTime(653_705), noon)
    val agnesMoved = CharacterMoved(agnes, Location(59.33, 18.07), Significance(10.0), WorldTime(653_705), noon)
    val agnesLeft = CharacterLeftTheMap(agnes, WorldTime(653_705), noon)

    /** The castle standing in Antarctica, held here by the sample house so that a holder is in the fixture. */
    val antarcticCastle = StructureId(UUID.fromString("95ba5c28-4a79-3fa6-88aa-0ff1f5a0a559"))
    val castleRaised = StructureRaised(
        structureId = antarcticCastle,
        structureType = StructureType("castle"),
        name = "the Antarctic castle",
        place = Location(-77.4, 10.0),
        significance = Significance(20.0),
        level = 1,
        holder = house,
        worldTime = WorldTime(653_705),
        recordedAt = noon,
    )

    /** The same castle, taken from the sample house by nobody: held by nobody since. */
    val castleLeft = StructureChangedHands(antarcticCastle, from = house, to = null, WorldTime(653_706), noon)

    /** The sample house's seat: the Antarctic castle, standing in for the one founding raises. */
    val seatNamed = HouseNamedSeat(house, antarcticCastle, WorldTime(653_705), noon)

    /** And lost, when the castle changed hands. */
    val seatLost = HouseLostSeat(house, antarcticCastle, WorldTime(653_706), noon)

    /** The same castle, fallen to fire and raised again for nobody. */
    /** A garrison of forty put in the castle, and taken out again; and Agnes in its dungeon, the other case. */
    val garrison = ContentId(UUID.fromString("7a000000-0000-4000-8000-000000000040"))
    val garrisoned = StructureSlotFilled(
        antarcticCastle, "garrison", Content.Item(garrison, "a garrison", "forty men of the coast", 40), WorldTime(653_706), noon,
    )
    val ungarrisoned = StructureSlotEmptied(antarcticCastle, "garrison", garrison, WorldTime(653_707), noon)
    val agnesImprisoned = StructureSlotFilled(antarcticCastle, "dungeon", Content.Person(agnes), WorldTime(653_706), noon)

    val castleLevelled = StructureLevelChanged(antarcticCastle, 2, Significance(24.0), WorldTime(653_706), noon)
    val castleFell = StructureRuined(antarcticCastle, "fire", WorldTime(653_707), noon)
    val castleRebuilt = StructureRebuilt(antarcticCastle, StructureType("castle"), 1, Significance(20.0), null, WorldTime(653_708), noon)

    val gotland = VisionId(UUID.fromString("dd000000-0000-4000-8000-000000000001"))
    val sawGotland = HouseGainedVision(house, gotland, Location(57.64, 18.30), 34.0, null, day, noon)
    val lostGotland = HouseLostVision(house, gotland, day, noon)

    // A dialogue with every case of every sealed field in it: each thing that can follow a line, a grant, a
    // requirement written into it, each thing a line can show, and a speaker who is a character beside one who
    // is not.
    val harbourMaster = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f7195790"))
    val theLady = Speaker(SpeakerId("agnes"), party = 0, name = "Agnes Hollin", portrait = "woman-03", character = agnes)
    val theRider = Speaker(SpeakerId("messenger"), party = 1, name = "A messenger", portrait = null, character = null)
    val aLetter = PlayerOfferedDialogue(
        houseId = house,
        player = player,
        dialogue = Dialogue(
            id = DialogueId(UUID.fromString("dd000000-0000-4000-8000-00000000a001")),
            title = "A letter from the coast",
            scene = "harbour",
            speakers = listOf(theLady, theRider),
            lines = listOf(
                Line(
                    id = LineId("arrives"),
                    speaker = theRider.id,
                    words = "A rider from the coast, my lady, with the harbour-master's seal.",
                    then = Then.Say(LineId("asks")),
                    shows = Shows.Place(Location(59.33, 18.07)),
                ),
                Line(
                    id = LineId("asks"),
                    speaker = theRider.id,
                    words = "He asks whether the house will stand behind the new quay.",
                    recorded = true,
                    then = Then.DialogueChoice(listOf(LineId("accept"), LineId("refuse"))),
                    shows = Shows.House(house),
                ),
                Line(
                    id = LineId("accept"),
                    speaker = theLady.id,
                    words = "Tell him it will, and send forty for the masons.",
                    effects = listOf(Effect.Spend(Resource.WEALTH, 40)),
                    revealImpact = RevealImpact.Shown(
                        listOf(Impact(Resource.WEALTH, -40), Impact(Resource.WEALTH, 100)),
                    ),
                    then = Then.Say(LineId("thanks")),
                ),
                Line(
                    id = LineId("refuse"),
                    speaker = theLady.id,
                    words = "Tell him the house has quays enough of its own.",
                    then = Then.End,
                    revealImpact = RevealImpact.Hidden,
                ),
                Line(
                    id = LineId("thanks"),
                    speaker = theRider.id,
                    words = "He will be glad of it. The first of the dues came with me.",
                    effects = listOf(Effect.Grant(Resource.WEALTH, 100)),
                    then = Then.End,
                    shows = Shows.Character(harbourMaster),
                ),
            ),
            requirements = listOf(Requirement.Alive(harbourMaster)),
        ),
        worldTime = day,
        recordedAt = noon,
    )

    val acceptedTheQuay = PlayerCompletedDialogueStep(house, player, aLetter.dialogue.id, LineId("accept"), day, noon)
    val theLetterRead = PlayerCompletedDialogue(house, player, aLetter.dialogue.id, day, noon)
    val theLetterLost = PlayerLostDialogue(house, player, aLetter.dialogue.id, Requirement.Alive(agnes), day, noon)

    /**
     * Another case of a sealed field than its type's sample writes, each pinned to a fixture of its own under
     * contracts/fixtures/events/cases: what fills a slot is a person or an item, and one sample cannot be both.
     */
    val cases: Map<String, Event> = mapOf(
        "villages.structure.slotFilled.v1.person" to agnesImprisoned,
    )

    val samples: Map<String, Event> = mapOf(
        "villages.character.aged.v1" to agnesAged,
        "villages.character.appeared.v1" to agnesAppeared,
        "villages.character.died.v1" to agnesDied,
        "villages.character.leftTheMap.v1" to agnesLeft,
        "villages.character.moved.v1" to agnesMoved,
        "villages.character.portraitChanged.v1" to agnesRedrawn,
        "villages.character.statChanged.v1" to agnesPiety,
        "villages.house.founded.v1" to ravenscar,
        "villages.house.gainedKeyFigure.v1" to tookAgnesIn,
        "villages.house.gainedVision.v1" to sawGotland,
        "villages.house.incomeChanged.v1" to paidByTheCastle,
        "villages.house.lostKeyFigure.v1" to lostAgnes,
        "villages.house.lostVision.v1" to lostGotland,
        "villages.house.lostSeat.v1" to seatLost,
        "villages.house.namedSeat.v1" to seatNamed,
        "villages.house.resourceGranted.v1" to givenGold,
        "villages.house.resourcePledged.v1" to pledgedReason,
        "villages.house.resourceReleased.v1" to releasedReason,
        "villages.house.resourceSpent.v1" to spentGold,
        "villages.player.completedDialogue.v1" to theLetterRead,
        "villages.player.completedDialogueStep.v1" to acceptedTheQuay,
        "villages.player.givenChoice.v1" to whereToSettle,
        "villages.player.lostDialogue.v1" to theLetterLost,
        "villages.player.offeredDialogue.v1" to aLetter,
        "villages.player.rolled.v1" to rolledARiver,
        "villages.player.tookAction.v1" to tookNorthern,
        "villages.structure.changedHands.v1" to castleLeft,
        "villages.structure.levelChanged.v1" to castleLevelled,
        "villages.structure.slotEmptied.v1" to ungarrisoned,
        "villages.structure.slotFilled.v1" to garrisoned,
        "villages.structure.raised.v1" to castleRaised,
        "villages.structure.rebuilt.v1" to castleRebuilt,
        "villages.structure.ruined.v1" to castleFell,
    )
}
