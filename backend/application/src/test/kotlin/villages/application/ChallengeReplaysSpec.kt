package villages.application

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import villages.domain.ChallengeId
import villages.domain.HouseId
import villages.domain.NodeId
import villages.domain.Opponent
import villages.domain.PlayerId
import villages.domain.QuestId
import villages.domain.challenge.Aspect
import villages.domain.challenge.Challenge
import villages.domain.challenge.ChallengeCatalogue
import villages.domain.challenge.ChallengeEffect
import villages.domain.challenge.ChallengeKind
import villages.domain.challenge.ChallengeSetup
import villages.domain.challenge.ChallengeSlice
import villages.domain.challenge.Fires
import villages.domain.challenge.Happening
import villages.domain.challenge.Progression
import villages.domain.challenge.SummonSpec
import java.time.Instant
import java.util.UUID

/** A challenge of a house's history fought again to be watched: from what was recorded, on what is in force. */
class ChallengeReplaysSpec : StringSpec({
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val house = HouseId.of(ada)
    val id = ChallengeId(UUID.fromString("c4000000-0000-4000-8000-0000000000d1"))

    val hirer = ChallengeSlice(Aspect.VIOLENCE, 50.0, 50.0, 1, listOf("violence.sellswords"))
    val idle = ChallengeSlice(Aspect.VIOLENCE, 50.0, 50.0, 1, emptyList())
    val content = ChallengeCatalogue(
        effects = listOf(ChallengeEffect("violence.sellswords", Aspect.VIOLENCE, Fires.TRIGGER, summons = "mercenary")),
        summons = mapOf("mercenary" to SummonSpec(Aspect.VIOLENCE, mapOf("pulls" to 10.0))),
        kinds = mapOf("skirmish" to ChallengeKind(5..9, 1..3, 0.0, mapOf(Aspect.REASON to 1.0))),
    )
    val setup = ChallengeSetup(listOf(hirer), listOf(idle), Progression(9, listOf(Happening(Aspect.VIOLENCE))))
    val fought = Challenge.resolve(setup, 41L, content, TEST_BALANCE.challenge)

    fun row(outcome: villages.domain.challenge.Outcome = fought.outcome) = ChallengeRow(
        house = house,
        player = ada,
        id = id,
        questId = QuestId(UUID.fromString("ee000000-0000-4000-8000-00000000a002")),
        questTitle = "A skirmish",
        nodeId = NodeId("square"),
        title = "A rival's challenge",
        kind = "skirmish",
        houseName = "Ravenscar",
        against = Opponent("A rival", "#a8452a"),
        brought = listOf("hirer"),
        setup = setup,
        seed = 41L,
        catalogue = "fingerprint",
        engine = Challenge.ENGINE,
        outcome = outcome,
        foughtAt = Instant.parse("2026-10-23T12:00:00Z"),
    )

    fun replays(held: ChallengeRow, inForce: ChallengeCatalogue = content) = ChallengeReplays(
        object : ChallengesByHouse {
            override fun of(house: HouseId): List<ChallengeRow> = if (house == held.house) listOf(held) else emptyList()

            override fun watch(listener: (ChallengesChange) -> Unit): AutoCloseable = AutoCloseable {}
        },
    ) { Catalogues(TEST_STRUCTURES, TEST_BALANCE, TEST_FATE, TEST_NAMES, challenges = inForce) }

    "fought again from its seed on what was in force, it comes out as it did, every moment the same" {
        val replay = replays(row()).replay(house, id).shouldNotBeNull()

        replay.again.shouldNotBeNull().moments shouldBe fought.moments
        replay.differs shouldBe false
    }

    "a recorded outcome the fight again does not come to is kept, and the replay says it differs" {
        val recorded = fought.outcome.copy(tug = -fought.outcome.tug, wonBy = null)

        val replay = replays(row(recorded)).replay(house, id).shouldNotBeNull()

        replay.row.outcome shouldBe recorded
        replay.differs shouldBe true
    }

    "a catalogue that no longer has what it was fought with cannot fight it again, and says so" {
        val replay = replays(row(), inForce = content.copy(effects = emptyList(), summons = emptyMap())).replay(house, id).shouldNotBeNull()

        replay.again.shouldBeNull()
        replay.differs shouldBe true
    }

    "a challenge the house did not fight, or another house's, is none" {
        replays(row()).replay(house, ChallengeId(UUID.randomUUID())).shouldBeNull()
        replays(row()).replay(HouseId.of(PlayerId(UUID.randomUUID())), id).shouldBeNull()
    }
})
