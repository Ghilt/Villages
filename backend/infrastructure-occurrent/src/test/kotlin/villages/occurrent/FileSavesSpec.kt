package villages.occurrent

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.StringSpec
import io.kotest.engine.spec.tempdir
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import villages.application.Provenance
import villages.application.SaveRefused
import villages.domain.Banner
import villages.domain.Charge
import villages.domain.Division
import villages.domain.FoundHouse
import villages.domain.GrantResource
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Resource
import villages.domain.Tincture
import villages.domain.WorldTime
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.io.path.readLines

class FileSavesSpec : StringSpec({
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val noon = Instant.parse("2026-10-17T12:00:00Z")

    fun aWorld(): InMemoryWorld = InMemoryWorld().also { world ->
        val banner = Banner(Tincture.AZURE, Division.PLAIN, null, Charge.STAG, Tincture.OR)
        val today = WorldTime(653_710)
        world.executor.execute(
            FoundHouse(HouseId.of(ada), ada, HouseName("Ravenscar"), Location(54.36, 18.64), banner, today, noon),
            Provenance.startedBy(UUID.randomUUID()),
        )
        world.executor.execute(GrantResource(HouseId.of(ada), Resource.WEALTH, 40, today, noon), Provenance.startedBy(UUID.randomUUID()))
    }

    fun at(instant: Instant): Clock = Clock.fixed(instant, ZoneOffset.UTC)

    "a save holds every stored event as the store holds it, its stream and its place in it too" {
        val world = aWorld()
        val folder = tempdir().toPath()
        val save = FileSaves(folder, world, at(noon)).save("first-test", ada)

        save.events shouldBe world.everyEvent().size
        val lines = folder.resolve("first-test.jsonl").readLines()
        lines.size shouldBe 1 + save.events
        val back = lines.drop(1).map(FileSaves::eventOf)
        back.map { it.id } shouldBe world.everyEvent().map { it.id }
        back.map { it.getExtension("streamid") } shouldBe world.everyEvent().map { it.getExtension("streamid") }
        back.map { it.getExtension("streamversion") } shouldBe world.everyEvent().map { (it.getExtension("streamversion") as Number).toLong() }
        back.map { world.converter.toDomainEvent(it) } shouldBe world.everyEvent().map { world.converter.toDomainEvent(it) }
        world.close()
    }

    "the saves are listed newest first, each with when it was made, by whom, and how many events it holds" {
        val world = aWorld()
        val folder = tempdir().toPath()
        FileSaves(folder, world, at(noon)).save("older", ada)
        FileSaves(folder, world, at(noon.plusSeconds(60))).save("newer", null)

        val listed = FileSaves(folder, world, at(noon)).saves()
        listed.map { it.name } shouldBe listOf("newer", "older")
        listed.map { it.by } shouldBe listOf(null, ada)
        listed.map { it.savedAt } shouldBe listOf(noon.plusSeconds(60), noon)
        listed.map { it.events } shouldBe listOf(2, 2)
        world.close()
    }

    "a name that is not one, or is taken, is refused, and nothing is written" {
        val world = aWorld()
        val folder = tempdir().toPath()
        val saves = FileSaves(folder, world, at(noon))
        listOf("", "Big Win", "../escape", "a--b", "-a", "x".repeat(61)).forEach { name ->
            shouldThrow<SaveRefused> { saves.save(name, ada) }.message shouldContain "not a save's name"
        }
        saves.saves().shouldBeEmpty()

        saves.save("taken", ada)
        shouldThrow<SaveRefused> { saves.save("taken", ada) }.message shouldContain "already"
        saves.saves().map { it.name } shouldBe listOf("taken")
        world.close()
    }

    "a folder that is not there yet holds no saves" {
        FileSaves(tempdir().toPath().resolve("not-yet"), InMemoryWorld(), at(noon)).saves().shouldBeEmpty()
    }
})
