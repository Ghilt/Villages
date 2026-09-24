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
    val stockholm = Location(59.33, 18.07)
    val ten = Significance(10.0)

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

    fun after(state: Character, events: List<CharacterEvent>): Character = events.fold(state, CharacterDecider::evolve)

    "a stat rises and falls by what it is changed by, and the event says where it now stands" {
        val events = CharacterDecider.decide(ChangeStat(agnes, Stat.PIETY, 2, today, noon), appeared())

        val changed = events.single().shouldBeInstanceOf<CharacterStatChanged>()
        changed.stat shouldBe Stat.PIETY
        changed.value shouldBe 15
        val character = after(appeared(), events).shouldBeInstanceOf<Character.Appeared>()
        character.stats[Stat.PIETY] shouldBe 15
        character.stats[Stat.REASON] shouldBe 9
    }

    "a stat never leaves one to twenty, and a change of nothing writes nothing" {
        shouldThrow<CharacterError.InvalidStat> { CharacterDecider.decide(ChangeStat(agnes, Stat.PHYSICAL, -7, today, noon), appeared()) }
        shouldThrow<CharacterError.InvalidStat> { CharacterDecider.decide(ChangeStat(agnes, Stat.PIETY, 8, today, noon), appeared()) }
        CharacterDecider.decide(ChangeStat(agnes, Stat.PIETY, 7, today, noon), appeared()) shouldHaveSize 1
        CharacterDecider.decide(ChangeStat(agnes, Stat.PIETY, 0, today, noon), appeared()) shouldHaveSize 0
    }

    "a character is aged out of the ordinary by years, and can be made younger by them again" {
        val older = after(appeared(), CharacterDecider.decide(AgeCharacter(agnes, 10, today, noon), appeared()))

        older.shouldBeInstanceOf<Character.Appeared>().agedYears shouldBe 10
        val again = after(older, CharacterDecider.decide(AgeCharacter(agnes, -10, today, noon), older))
        again.shouldBeInstanceOf<Character.Appeared>().agedYears shouldBe 0
        CharacterDecider.decide(AgeCharacter(agnes, 0, today, noon), appeared()) shouldHaveSize 0
    }

    /** Agnes is eleven thousand and five days old, which is thirty years and a little. */
    "nobody is made younger than newborn, nor aged more than two hundred years at once" {
        CharacterDecider.decide(AgeCharacter(agnes, -30, today, noon), appeared()) shouldHaveSize 1
        shouldThrow<CharacterError.InvalidAge> { CharacterDecider.decide(AgeCharacter(agnes, -31, today, noon), appeared()) }
        shouldThrow<CharacterError.InvalidAge> {
            CharacterDecider.decide(AgeCharacter(agnes, CharacterDecider.MOST_YEARS_AT_ONCE + 1, today, noon), appeared())
        }
    }

    "a portrait can be swapped or taken away, and swapping it for itself writes nothing" {
        val swapped = CharacterDecider.decide(ChangePortrait(agnes, "woman-04", today, noon), appeared()).single()

        swapped.shouldBeInstanceOf<CharacterPortraitChanged>().portrait shouldBe "woman-04"
        after(appeared(), listOf(swapped)).shouldBeInstanceOf<Character.Appeared>().portrait shouldBe "woman-04"
        CharacterDecider.decide(ChangePortrait(agnes, null, today, noon), appeared()) shouldHaveSize 1
        CharacterDecider.decide(ChangePortrait(agnes, "woman-03", today, noon), appeared()) shouldHaveSize 0
        shouldThrow<CharacterError.InvalidPortrait> { CharacterDecider.decide(ChangePortrait(agnes, "Woman 04", today, noon), appeared()) }
    }

    "a character is on no map until they are moved onto one, and then stands where they were put" {
        appeared().shouldBeInstanceOf<Character.Appeared>().place.shouldBeNull()

        val moved = CharacterDecider.decide(MoveCharacter(agnes, stockholm, ten, today, noon), appeared()).single()

        val came = moved.shouldBeInstanceOf<CharacterMoved>()
        came.place shouldBe stockholm
        came.significance shouldBe ten
        val there = after(appeared(), listOf(moved)).shouldBeInstanceOf<Character.Appeared>()
        there.place shouldBe stockholm
        there.significance shouldBe ten
    }

    "moving somebody to where they stand, mattering as much, is no move; moving them on is" {
        val there = after(appeared(), CharacterDecider.decide(MoveCharacter(agnes, stockholm, ten, today, noon), appeared()))

        CharacterDecider.decide(MoveCharacter(agnes, stockholm, ten, today, noon), there) shouldHaveSize 0
        CharacterDecider.decide(MoveCharacter(agnes, stockholm, Significance(30.0), today, noon), there) shouldHaveSize 1
        CharacterDecider.decide(MoveCharacter(agnes, Location(60.17, 24.94), ten, today, noon), there) shouldHaveSize 1
    }

    "a character taken off the map is nowhere again, and nobody is taken off a map they are not on" {
        val there = after(appeared(), CharacterDecider.decide(MoveCharacter(agnes, stockholm, ten, today, noon), appeared()))
        val left = CharacterDecider.decide(TakeOffTheMap(agnes, today, noon), there).single()

        left.shouldBeInstanceOf<CharacterLeftTheMap>()
        val nowhere = after(there, listOf(left)).shouldBeInstanceOf<Character.Appeared>()
        nowhere.place.shouldBeNull()
        nowhere.significance.shouldBeNull()
        shouldThrow<CharacterError.NotOnTheMap> { CharacterDecider.decide(TakeOffTheMap(agnes, today, noon), nowhere) }
        shouldThrow<CharacterError.NoSuchCharacter> {
            CharacterDecider.decide(TakeOffTheMap(agnes, today, noon), CharacterDecider.initial)
        }
    }

    // A death does not also write that they left the map: where they stood is where they died.
    "a death leaves them where they stood, and the dead are neither moved nor taken off the map" {
        val there = after(appeared(), CharacterDecider.decide(MoveCharacter(agnes, stockholm, ten, today, noon), appeared()))
        val died = CharacterDecider.decide(killing, there)

        died.single().shouldBeInstanceOf<CharacterDied>()
        val dead = after(there, died).shouldBeInstanceOf<Character.Appeared>()
        dead.place shouldBe stockholm
        shouldThrow<CharacterError.AlreadyDead> { CharacterDecider.decide(TakeOffTheMap(agnes, today, noon), dead) }
    }

    "the dead do not change" {
        val dead = after(appeared(), CharacterDecider.decide(killing, appeared()))

        shouldThrow<CharacterError.AlreadyDead> { CharacterDecider.decide(ChangeStat(agnes, Stat.PIETY, 1, today, noon), dead) }
        shouldThrow<CharacterError.AlreadyDead> { CharacterDecider.decide(AgeCharacter(agnes, 1, today, noon), dead) }
        shouldThrow<CharacterError.AlreadyDead> { CharacterDecider.decide(ChangePortrait(agnes, "woman-04", today, noon), dead) }
        shouldThrow<CharacterError.AlreadyDead> { CharacterDecider.decide(MoveCharacter(agnes, stockholm, ten, today, noon), dead) }
    }

    "folding is total: a death on a stream with nobody on it changes nothing" {
        val stray = CharacterDied(agnes, "nothing", today, noon)

        CharacterDecider.evolve(CharacterDecider.initial, stray) shouldBe Character.NotAppeared
    }
})
