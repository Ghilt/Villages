package villages.domain

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

/**
 * The first test in the backend proves the build rather than the code: that tests run on the Java the
 * toolchain was pinned to, whatever JDK happens to run Gradle. Occurrent needs 21 or later, and 25 is what lets a
 * virtual thread blocked in a monitor give its carrier back (JEP 491, experiment 0023); a build that quietly tested
 * on 17 would pass here and fail in the event store.
 */
class ToolchainSpec : StringSpec({
    "tests run on the Java the toolchain asks for" {
        Runtime.version().feature() shouldBe 25
    }
})
