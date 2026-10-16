package villages.bots

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain

/** The run against a stand-in server and stand-in bots, whose round trips each stage takes as long as it is told. */
class RampSpec : StringSpec({

    class FakeServer : Server {
        var stopped = 0
        var cpu = 0L

        override fun start() = Started(port = 1234, tookMs = 3_000)

        override fun read(): Reading {
            cpu += 500
            return Reading(heapUsedMb = 100, heapTotalMb = 256, threads = 40, cpuMs = cpu)
        }

        override fun stop() {
            stopped++
        }
    }

    // Each stage's bots take `took(players)` ms over every trip, and lose `lost(players)` of themselves.
    class FakeBots(private val took: (Int) -> Long, private val lost: (Int) -> Int = { 0 }, private val throwAt: Int? = null) : Bots {
        override val trips = RoundTrips()
        var players = 0
        var closed = false

        override fun growTo(count: Int) {
            check(count != throwAt) { "the machine ran out of sockets" }
            players = count
            repeat(count) { trips.started(Trip.WELCOME, "$count $it", 0); trips.finished(Trip.WELCOME, "$count $it", took(count)) }
        }

        override fun lost() = lost(players)

        override fun close() {
            closed = true
        }
    }

    fun ramp(server: Server, bots: Bots, stages: List<Int> = listOf(100, 1_000, 2_500)) =
        Ramp(server, { bots }, Settings(stages = stages, holdMs = 0, warmUp = 0), sleep = {}).run()

    "goes through every stage when none bends, and stops its server and its bots at the end" {
        val server = FakeServer()
        val bots = FakeBots(took = { 20 })

        val run = ramp(server, bots)

        run.stages.map { it.players } shouldBe listOf(100, 1_000, 2_500)
        run.stages.map { it.bent } shouldBe listOf(null, null, null)
        run.stages.first().trips.getValue(Trip.WELCOME) shouldBe Percentiles(100, 20, 20, 20)
        run.stages.map { it.cpuMs } shouldBe listOf(500L, 500L, 500L)
        server.stopped shouldBe 1
        bots.closed shouldBe true
    }

    "stops at the first stage whose slowest twentieth is over the bend" {
        val run = ramp(FakeServer(), FakeBots(took = { players -> if (players >= 1_000) 800 else 20 }))

        run.stages.map { it.players } shouldBe listOf(100, 1_000)
        run.stages.last().bent!! shouldContain "p95 welcome 800 ms"
    }

    "bends when more than one in a hundred bots are lost" {
        val run = ramp(FakeServer(), FakeBots(took = { 20 }, lost = { players -> players / 50 }))

        run.stages.map { it.players } shouldBe listOf(100)
        run.stages.last().bent shouldBe "2 of 100 bots lost"
    }

    "stops its server however the run ends, and keeps what it measured until then" {
        val server = FakeServer()
        val bots = FakeBots(took = { 20 }, throwAt = 1_000)

        val run = ramp(server, bots)

        run.stages.map { it.players } shouldBe listOf(100)
        run.aborted!! shouldContain "ran out of sockets"
        server.stopped shouldBe 1
        bots.closed shouldBe true
    }

    "warms up first, shows the warm-up, and never judges it however slow it was" {
        val bots = FakeBots(took = { players -> if (players == 50) 900 else 20 })
        val run = Ramp(FakeServer(), { bots }, Settings(stages = listOf(100), holdMs = 0, warmUpMs = 0), sleep = {}).run()

        run.stages.map { it.players to it.warmUp } shouldBe listOf(50 to true, 100 to false)
        run.stages.map { it.bent } shouldBe listOf(null, null)
        run.stages.first().trips.getValue(Trip.WELCOME)!!.p95 shouldBe 900L
    }

    "says where a run bent, or that it did not" {
        Report.summary(ramp(FakeServer(), FakeBots(took = { 20 }))) shouldContain "carried 2500 players without bending"
        Report.summary(ramp(FakeServer(), FakeBots(took = { 900 }))) shouldContain "bent at 100 players"
    }
})
