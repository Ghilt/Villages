package villages.occurrent

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import villages.application.EventFeed
import villages.application.Follower
import villages.application.Later
import villages.application.Provenance
import villages.application.Reaction
import villages.application.ScheduledLater
import villages.application.StoredEvent
import villages.application.WipeGate
import villages.application.started
import villages.domain.Banner
import villages.domain.CharacterId
import villages.domain.CharacterName
import villages.domain.Charge
import villages.domain.Division
import villages.domain.FoundHouse
import villages.domain.HouseFounded
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.IntroduceCharacter
import villages.domain.Location
import villages.domain.PlayerId
import villages.domain.Sex
import villages.domain.Species
import villages.domain.Stat
import villages.domain.Tincture
import villages.domain.WorldTime
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * What a wipe guarantees, each part against the race it closes: the feed hands events on on its own threads, a
 * moment after they are written, and commands and reactions run on threads of their own too. Every test here
 * fails without the part it names. See decision record 0036.
 */
class WipeSpec : StringSpec({
    val noon = Instant.parse("2026-10-11T12:00:00Z")
    val ravenscar = FoundHouse(
        houseId = HouseId(UUID.fromString("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a")),
        player = PlayerId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d")),
        name = HouseName("Ravenscar"),
        seat = Location(59.33, 18.07),
        banner = Banner(Tincture.SABLE, Division.PLAIN, null, Charge.STAG, Tincture.ARGENT),
        worldTime = WorldTime(454901),
        recordedAt = noon,
    )
    val hollin = ravenscar.copy(
        houseId = HouseId(UUID.fromString("0b7a2c9d-4e6f-4a1b-8c2d-3e4f5a6b7c8d")),
        name = HouseName("Hollin"),
    )
    // A new stream written in consequence of a founding, as a castle is raised for a house.
    val agnes = IntroduceCharacter(
        characterId = CharacterId(UUID.fromString("cb732500-39bd-3b39-a838-bb89f719578f")),
        name = CharacterName("Agnes", "Ravenscar"),
        sex = Sex.WOMAN,
        species = Species.PERSON,
        bornOn = WorldTime(642_700),
        stats = mapOf(Stat.PIETY to 13, Stat.REASON to 9, Stat.KINDNESS to 11, Stat.PHYSICAL to 7),
        portrait = null,
        worldTime = WorldTime(653_705),
        recordedAt = noon,
    )
    val sent = Provenance.startedBy(UUID.fromString("1c000001-0000-4000-8000-00000000000a"))

    "an event the feed is still handing on when the wipe begins is not folded into the world after it" {
        InMemoryWorld().use { world ->
            SlowToFold(world.feed).started().use { slow ->
                world.executor.execute(ravenscar, sent)
                slow.folding.await(5, TimeUnit.SECONDS) shouldBe true

                world.wipe(listOf(slow)) shouldBe 1

                slow.folded.await(5, TimeUnit.SECONDS) shouldBe true
                slow.held.shouldBeEmpty()
            }
        }
    }

    "a command sent while a wipe is under way is written after it, and folded into the world it is written in" {
        InMemoryWorld().use { world ->
            val slow = SlowToForget(world.feed).started()
            val kept = Kept(world.feed).started()
            world.executor.execute(ravenscar, sent)
            waitFor("the founding to be folded") { kept.held == listOf(ravenscar.houseId.stream) }

            val wiping = thread { world.wipe(listOf(slow, kept)) }
            slow.forgetting.await(5, TimeUnit.SECONDS) shouldBe true
            world.executor.execute(hollin, sent)
            wiping.join()

            world.store.read(hollin.houseId.stream).version() shouldBe 1
            waitFor("the founding after the wipe to be folded") { kept.held == listOf(hollin.houseId.stream) }
        }
    }

    "an event handed on late sets no reaction off in the world after the wipe" {
        InMemoryWorld().use { world ->
            ScheduledLater(world.faults).use { later ->
                val echo = Echo(world, later, hearingMs = 200) { world.characterExecutor.execute(agnes, sent) }.started()
                world.executor.execute(ravenscar, sent)
                echo.heard.await(5, TimeUnit.SECONDS) shouldBe true

                world.wipe(listOf(echo)) shouldBe 1

                echo.planned.await(5, TimeUnit.SECONDS) shouldBe true
                settled(later)
                world.store.read(agnes.characterId.stream).version() shouldBe 0
            }
        }
    }

    "a reaction's command under way when a wipe begins is finished first, and goes with the world it was written in" {
        InMemoryWorld().use { world ->
            ScheduledLater(world.faults).use { later ->
                val echo = Echo(world, later, issuingMs = 200) { world.characterExecutor.execute(agnes, sent) }.started()
                world.executor.execute(ravenscar, sent)
                echo.issuing.await(5, TimeUnit.SECONDS) shouldBe true

                world.wipe(listOf(echo)) shouldBe 2

                echo.issued.await(5, TimeUnit.SECONDS) shouldBe true
                world.store.read(agnes.characterId.stream).version() shouldBe 0
            }
        }
    }
})

/** Waits for something to be true, rather than for a length of time. */
internal fun waitFor(what: String, ready: () -> Boolean) {
    val giveUp = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
    while (!ready()) {
        check(System.nanoTime() < giveUp) { "gave up waiting for $what" }
        Thread.sleep(10)
    }
}

/** Waits until a Later on one thread has run everything planned on it so far. */
private fun settled(later: Later) {
    val done = CountDownLatch(1)
    later.schedule(0) { done.countDown() }
    done.await(5, TimeUnit.SECONDS) shouldBe true
}

/** A read model whose fold is slow, so that what it is folding when a wipe begins is still being folded after it. */
internal class SlowToFold(feed: EventFeed) : Follower(feed) {
    val held = CopyOnWriteArrayList<String>()
    val folding = CountDownLatch(1)
    val folded = CountDownLatch(1)

    override fun apply(stored: StoredEvent) {
        folding.countDown()
        Thread.sleep(200)
        held += stored.stream
        folded.countDown()
    }

    override fun reset() = held.clear()
}

/** A read model that is slow to forget, which holds a wipe open long enough for a command to arrive in it. */
private class SlowToForget(feed: EventFeed) : Follower(feed) {
    val forgetting = CountDownLatch(1)

    override fun apply(stored: StoredEvent) = Unit

    override fun reset() {
        forgetting.countDown()
        Thread.sleep(200)
    }
}

/** A read model that keeps the stream of everything it folds. */
private class Kept(feed: EventFeed) : Follower(feed) {
    val held = CopyOnWriteArrayList<String>()

    override fun apply(stored: StoredEvent) {
        held += stored.stream
    }

    override fun reset() = held.clear()
}

/**
 * A reaction to a founding that writes a stream of its own, as the seats listener raises a castle: slow to hear
 * the founding by [hearingMs], or slow over the command it issues by [issuingMs].
 */
private class Echo(
    world: InMemoryWorld,
    later: Later,
    private val hearingMs: Long = 0,
    private val issuingMs: Long = 0,
    private val then: () -> Unit,
) : Reaction("an echo", world.feed, later, world.faults, world.gate) {
    val heard = CountDownLatch(1)
    val planned = CountDownLatch(1)
    val issuing = CountDownLatch(1)
    val issued = CountDownLatch(1)

    override fun apply(stored: StoredEvent) {
        if (stored.event !is HouseFounded) return
        heard.countDown()
        Thread.sleep(hearingMs)
        issueLater("echoing ${stored.stream}") {
            issuing.countDown()
            Thread.sleep(issuingMs)
            then()
            issued.countDown()
        }
        planned.countDown()
    }

    override fun forget() = Unit
}
