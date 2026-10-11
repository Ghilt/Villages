package villages.occurrent

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import java.time.Duration
import kotlin.concurrent.thread

/** What a wipe in MongoDB waits on: every subscription live when a marker is written reaching it. */
class MarkersSpec : StringSpec({
    val long = Duration.ofSeconds(5)

    "a marker is passed once every subscription live when it was written has reached it, in whatever order" {
        val markers = Markers().apply { joined("a"); joined("b") }
        markers.expect("m")

        val reaching = thread { Thread.sleep(50); markers.reached("b", "m"); markers.reached("a", "m") }

        markers.awaitAll("m", long) shouldBe true
        reaching.join()
    }

    "a subscription that closes is not waited for" {
        val markers = Markers().apply { joined("a"); joined("b") }
        markers.expect("m")
        markers.reached("a", "m")

        thread { Thread.sleep(50); markers.gone("b") }

        markers.awaitAll("m", long) shouldBe true
    }

    "a subscription that comes after the marker was written is not waited for" {
        val markers = Markers().apply { joined("a") }
        markers.expect("m")
        markers.joined("late")
        markers.reached("a", "m")

        markers.awaitAll("m", long) shouldBe true
    }

    "a subscription that never reaches it is given up on, and the wait says so" {
        val markers = Markers().apply { joined("a"); joined("stuck") }
        markers.expect("m")
        markers.reached("a", "m")

        markers.awaitAll("m", Duration.ofMillis(100)) shouldBe false
    }
})
