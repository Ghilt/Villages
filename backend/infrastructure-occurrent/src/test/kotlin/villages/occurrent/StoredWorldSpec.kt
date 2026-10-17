package villages.occurrent

import io.cloudevents.CloudEvent
import io.cloudevents.core.builder.CloudEventBuilder
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.occurrent.eventstore.api.SortBy
import tools.jackson.databind.node.ObjectNode
import villages.application.Provenance
import villages.domain.Banner
import villages.domain.ChangeStat
import villages.domain.CharacterDecider
import villages.domain.CharacterEvent
import villages.domain.CharacterId
import villages.domain.CharacterName
import villages.domain.Charge
import villages.domain.Content
import villages.domain.Division
import villages.domain.FillSlot
import villages.domain.FoundHouse
import villages.domain.GrantResource
import villages.domain.HandOver
import villages.domain.HouseDecider
import villages.domain.HouseEvent
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.IntroduceCharacter
import villages.domain.LevelSpec
import villages.domain.Location
import villages.domain.MoveCharacter
import villages.domain.PlayerId
import villages.domain.RaiseStructure
import villages.domain.Resource
import villages.domain.SeenBy
import villages.domain.Sex
import villages.domain.Significance
import villages.domain.SlotSpec
import villages.domain.SpendResource
import villages.domain.Species
import villages.domain.Stat
import villages.domain.StructureCatalogue
import villages.domain.StructureDecider
import villages.domain.StructureEvent
import villages.domain.StructureId
import villages.domain.StructureSpec
import villages.domain.StructureType
import villages.domain.Takes
import villages.domain.Tincture
import villages.domain.WorldTime
import java.io.File
import java.net.URI
import java.time.Instant
import java.time.OffsetDateTime
import java.util.UUID

/**
 * A store written by the code of a day, kept as it was written, and read by the code of every day after: each file in
 * contracts/fixtures/stores is a little world's whole history, recorded once by [record] through the real executors and
 * never changed again. Every event in every recording must still read - through the upcasters, if its type has been
 * retired since - and every stream must still fold, or the change that broke it needs an upcaster first. See decision
 * record 0100.
 *
 * Recording is a deliberate act: `./gradlew :infrastructure-occurrent:test -Dstore.record=true` writes today's file.
 */
class StoredWorldSpec : StringSpec({
    val folder = File("../../contracts/fixtures/stores")

    if (System.getProperty("store.record") == "true") {
        "today's store is recorded" {
            record(File(folder, "${java.time.LocalDate.now()}.jsonl"))
        }
    }

    "every store ever recorded reads back whole, and every stream in it folds" {
        val recordings = folder.listFiles().orEmpty().filter { it.name.endsWith(".jsonl") }.sortedBy { it.name }
        recordings.shouldNotBeEmpty()
        val converter = Events.converter()
        for (recording in recordings) {
            val events = recording.readLines().filter(String::isNotBlank).map { converter.toDomainEvent(cloudEventOf(it)) }
            withClue(recording.name) {
                events.shouldNotBeEmpty()
                val houses = events.filterIsInstance<HouseEvent>().groupBy { it.houseId }
                val characters = events.filterIsInstance<CharacterEvent>().groupBy { it.characterId }
                val structures = events.filterIsInstance<StructureEvent>().groupBy { it.structureId }
                houses.isEmpty() shouldBe false
                houses.values.forEach { HouseDecider.fold(it) shouldNotBe HouseDecider.initial }
                characters.values.forEach { CharacterDecider.fold(it) shouldNotBe CharacterDecider.initial }
                // A fold reads no catalogue: what a structure is was written into its events when they were decided.
                val folding = StructureDecider { error("a fold reads no catalogue") }
                structures.values.forEach { folding.fold(it) shouldNotBe folding.initial }
            }
        }
    }
})

/** One line of a recording back into the CloudEvent it was stored as. */
private fun cloudEventOf(line: String): CloudEvent {
    val kept = Events.json.readTree(line)
    val built = CloudEventBuilder.v1()
        .withId(kept["id"].asString())
        .withType(kept["type"].asString())
        .withSource(URI.create(kept["source"].asString()))
        .withSubject(kept["subject"].asString())
        .withTime(OffsetDateTime.parse(kept["time"].asString()))
        .withData("application/json", Events.json.writeValueAsBytes(kept["data"]))
    kept["extensions"]?.properties()?.forEach { (name, value) -> built.withExtension(name, value.asString()) }
    return built.build()
}

/**
 * A little world's history, written by today's executors: two houses founded, resources granted and spent, a mill raised
 * and handed on and a person set in it, a person brought in, moved and grown more pious. Each line is a stored
 * CloudEvent, oldest first.
 */
private fun record(to: File) {
    val today = WorldTime(653_710)
    val noon = Instant.parse("2026-10-17T12:00:00Z")
    val banner = Banner(Tincture.AZURE, Division.PLAIN, null, Charge.STAG, Tincture.OR)
    val mill = StructureType("mill")
    val catalogue = StructureCatalogue(
        mapOf(
            mill to StructureSpec(
                listOf(LevelSpec(Significance(8.0), 6.0, mapOf(Resource.WEALTH to 86_400.0))),
                listOf(SlotSpec("miller", Takes.CHARACTER, listOf(1), SeenBy.ALL, scales = Stat.REASON)),
            ),
        ),
    )
    val world = InMemoryWorld()
    val because = { Provenance.startedBy(UUID.randomUUID()) }
    val ada = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d"))
    val bea = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8e"))
    val theMill = StructureId(UUID.fromString("5d000000-0000-4000-8000-0000000000a1"))
    val miller = CharacterId(UUID.fromString("cc000000-0000-4000-8000-0000000000a1"))
    val stats = mapOf(Stat.PIETY to 9, Stat.REASON to 12, Stat.KINDNESS to 10, Stat.PHYSICAL to 11)

    world.executor.execute(FoundHouse(HouseId.of(ada), ada, HouseName("Ravenscar"), Location(54.36, 18.64), banner, today, noon), because())
    world.executor.execute(FoundHouse(HouseId.of(bea), bea, HouseName("Hollin"), Location(59.33, 18.07), banner, today, noon), because())
    world.executor.execute(GrantResource(HouseId.of(ada), Resource.WEALTH, 40, today, noon), because())
    world.executor.execute(SpendResource(HouseId.of(ada), Resource.WEALTH, 15, today, noon), because())
    world.characterExecutor.execute(
        IntroduceCharacter(miller, CharacterName("Odo", "of the Mill"), Sex.MAN, Species.PERSON, WorldTime(642_700), stats, null, today, noon),
        because(),
    )
    world.characterExecutor.execute(MoveCharacter(miller, Location(54.37, 18.65), Significance(10.0), today, noon), because())
    world.characterExecutor.execute(ChangeStat(miller, Stat.PIETY, 2, today, noon), because())
    val structures = world.structureExecutor { catalogue }
    structures.execute(RaiseStructure(theMill, mill, "the mill at Dantzic", Location(54.36, 18.64), 1, HouseId.of(ada), today, noon), because())
    structures.execute(FillSlot(theMill, "miller", Content.Person(miller), today, noon), because())
    structures.execute(HandOver(theMill, HouseId.of(bea), WorldTime(today.day + 3), noon), because())

    to.parentFile.mkdirs()
    to.bufferedWriter().use { out ->
        world.store.all(SortBy.natural(SortBy.SortDirection.ASCENDING)).use { stored ->
            stored.forEach { event ->
                val line = Events.json.createObjectNode()
                line.put("id", event.id).put("type", event.type).put("source", event.source.toString())
                    .put("subject", event.subject).put("time", event.time!!.toString())
                val extensions = line.putObject("extensions")
                event.extensionNames.filter { it in setOf(Events.CORRELATION_ID, Events.CAUSATION_ID) }
                    .forEach { extensions.put(it, event.getExtension(it)!!.toString()) }
                line.set("data", Events.json.readTree(event.data!!.toBytes()) as ObjectNode)
                // One line feed, on every machine: the file is the same wherever it was recorded.
                out.write(Events.json.writeValueAsString(line))
                out.write(LINE_FEED.code)
            }
        }
    }
}

/** One line feed, not the machine's own line separator. */
private const val LINE_FEED = 10.toChar()
