package villages.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.time.Instant
import java.util.UUID

class CharacterDeciderSpec : StringSpec({
    val noon = Instant.parse("2026-09-04T12:00:00Z")
    val agnes = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f"))
    val today = WorldTime(653_705)
    val stats = mapOf(Stat.PIETY to 13, Stat.REASON to 9, Stat.KINDNESS to 11, Stat.PHYSICAL to 7)

    fun introducing(
        stats: Map<Stat, Int> = mapOf(Stat.PIETY to 13, Stat.REASON to 9, Stat.KINDNESS to 11, Stat.PHYSICAL to 7),
        bornOn: WorldTime = WorldTime(642_700),
        portrait: String? = "woman-03",
    ) = IntroduceCharacter(
        characterId = agnes,
        name = CharacterName("Agnes", "Hollin"),
        sex = Sex.WOMAN,
        species = Species.PERSON,
        bornOn = bornOn,
        stats = stats,
        portrait = portrait,
        worldTime = today,
        recordedAt = noon,
    )

    fun appeared(): Character = CharacterDecider.fold(CharacterDecider.decide(introducing(), CharacterDecider.initial))

    val killing = KillCharacter(agnes, "a fever that did not break", today, noon)

    "a character appears once, with everything they were introduced with" {
        val events = CharacterDecider.decide(introducing(), CharacterDecider.initial)

        events shouldHaveSize 1
        val came = events.single().shouldBeInstanceOf<CharacterAppeared>()
        came.characterId shouldBe agnes
        came.name shouldBe CharacterName("Agnes", "Hollin")
        came.sex shouldBe Sex.WOMAN
        came.species shouldBe Species.PERSON
        came.bornOn shouldBe WorldTime(642_700)
        came.stats shouldBe stats
        came.portrait shouldBe "woman-03"
        came.worldTime shouldBe today
        came.recordedAt shouldBe noon
    }

    "appearing again is refused, so a command sent twice never makes a twin" {
        shouldThrow<CharacterError.AlreadyAppeared> { CharacterDecider.decide(introducing(), appeared()) }
    }

    "the state folded from the events is the character who appeared, alive" {
        val character = appeared().shouldBeInstanceOf<Character.Appeared>()

        character.id shouldBe agnes
        character.bornOn shouldBe WorldTime(642_700)
        character.appearedOn shouldBe today
        character.death.shouldBeNull()
    }

    "every stat must be there, and every one between one and twenty" {
        shouldThrow<CharacterError.InvalidStat> {
            CharacterDecider.decide(introducing(stats = stats - Stat.KINDNESS), CharacterDecider.initial)
        }
        shouldThrow<CharacterError.InvalidStat> {
            CharacterDecider.decide(introducing(stats = stats + (Stat.PIETY to 0)), CharacterDecider.initial)
        }
        shouldThrow<CharacterError.InvalidStat> {
            CharacterDecider.decide(introducing(stats = stats + (Stat.PHYSICAL to 21)), CharacterDecider.initial)
        }
        CharacterDecider.decide(introducing(stats = stats + (Stat.PIETY to 1) + (Stat.REASON to 20)), CharacterDecider.initial) shouldHaveSize 1
    }

    "nobody is born after the day they appear, though they may be born on it" {
        shouldThrow<CharacterError.InvalidAge> {
            CharacterDecider.decide(introducing(bornOn = today + 1), CharacterDecider.initial)
        }
        CharacterDecider.decide(introducing(bornOn = today), CharacterDecider.initial) shouldHaveSize 1
    }

    "a portrait is a file's name or none at all" {
        shouldThrow<CharacterError.InvalidPortrait> {
            CharacterDecider.decide(introducing(portrait = "Woman 03.png"), CharacterDecider.initial)
        }
        shouldThrow<CharacterError.InvalidPortrait> {
            CharacterDecider.decide(introducing(portrait = "../woman-03"), CharacterDecider.initial)
        }
        val without = CharacterDecider.decide(introducing(portrait = null), CharacterDecider.initial).single()
        without.shouldBeInstanceOf<CharacterAppeared>().portrait.shouldBeNull()
    }

    "a character dies once, for the cause given" {
        val events = CharacterDecider.decide(killing, appeared())

        val died = events.single().shouldBeInstanceOf<CharacterDied>()
        died.characterId shouldBe agnes
        died.cause shouldBe "a fever that did not break"

        val dead = CharacterDecider.evolve(appeared(), died).shouldBeInstanceOf<Character.Appeared>()
        dead.death shouldBe Death(today, "a fever that did not break")
        shouldThrow<CharacterError.AlreadyDead> { CharacterDecider.decide(killing, dead) }
    }

    "nobody can kill a character who never appeared" {
        shouldThrow<CharacterError.NoSuchCharacter> { CharacterDecider.decide(killing, CharacterDecider.initial) }
    }

    "a cause of death is said in a line" {
        shouldThrow<CharacterError.InvalidCause> { CharacterDecider.decide(killing.copy(cause = "  "), appeared()) }
        shouldThrow<CharacterError.InvalidCause> {
            CharacterDecider.decide(killing.copy(cause = "a".repeat(CharacterDecider.LONGEST_CAUSE + 1)), appeared())
        }
    }

    "folding is total: a death on a stream with nobody on it changes nothing" {
        val stray = CharacterDied(agnes, "nothing", today, noon)

        CharacterDecider.evolve(CharacterDecider.initial, stray) shouldBe Character.NotAppeared
    }
})
