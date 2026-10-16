package villages.bots

import io.kotest.core.spec.style.StringSpec
import io.kotest.engine.spec.tempfile
import io.kotest.matchers.shouldBe
import java.time.Instant

class HistorySpec : StringSpec({

    val code = Code("abc123", "claude/somewhere", dirty = false)
    val machine = Machine("BOX", "Windows 11", "a cpu", 20, 32)
    val reading = Reading(heapUsedMb = 100, heapTotalMb = 256, threads = 40, cpuMs = 500)

    fun stage(players: Int, warmUp: Boolean = false, bent: String? = null) =
        StageResult(players, warmUp, 10, mapOf(Trip.WELCOME to Percentiles(1, 5, 6, 7)), 0, 0, emptyMap(), reading, 500, bent)

    fun history(file: java.io.File) = History(file, code, machine, Settings(), serverHeapGb = 8)

    "writes one line a run, once, saying what it carried and where it bent" {
        val file = tempfile()
        file.writeText("")
        val history = history(file)
        val run = RunResult(Started(1, 3_000), listOf(stage(50, warmUp = true), stage(100), stage(1_000, bent = "p95 welcome 900 ms, over 500")), null)

        history.finish(run, Instant.parse("2026-10-16T12:00:00Z")) shouldBe true
        history.finish(run) shouldBe false

        val lines = file.readLines()
        lines.size shouldBe 1
        val line = History.MAPPER.readTree(lines.single())
        line["at"].asString() shouldBe "2026-10-16T12:00:00Z"
        line["code"]["commit"].asString() shouldBe "abc123"
        line["carried"].asInt() shouldBe 100
        line["bentAt"].asInt() shouldBe 1_000
        line["aborted"].asBoolean() shouldBe false
        line["stages"].size() shouldBe 3
        line["stages"][1]["trips"]["WELCOME"]["p95"].asInt() shouldBe 6
    }

    "writes a run that was stopped part way as aborted, with the stages it got through, after the runs before it" {
        val file = tempfile()
        file.writeText("{\"an\":\"earlier run\"}\n")

        history(file).finish(RunResult(Started(1, 3_000), listOf(stage(100)), aborted = "interrupted"))

        val line = History.MAPPER.readTree(file.readLines().last())
        file.readLines().size shouldBe 2
        line["aborted"].asBoolean() shouldBe true
        line["abortedWhy"].asString() shouldBe "interrupted"
        line["carried"].asInt() shouldBe 100
        line["bentAt"].isNull shouldBe true
    }
})
