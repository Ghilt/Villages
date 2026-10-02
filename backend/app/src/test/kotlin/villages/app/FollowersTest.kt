package villages.app

import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import villages.application.Follower

/**
 * Every follower the app is made of has been started. A read model or a listener declared without
 * `initMethod = "start"` would fold nothing and say nothing, and this is what says it. The wipe needs no such
 * test: it empties every `Resettable` there is, and a follower is one.
 *
 * JUnit rather than Kotest here, as in the rest of this module, and the same context as `AppBootsTest`.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class FollowersTest {
    @Autowired
    lateinit var context: ApplicationContext

    @Test
    fun `every follower is started as the app is made`() {
        val followers = context.getBeansOfType(Follower::class.java)

        assertTrue(followers.isNotEmpty(), "the app is made of no followers at all")
        for ((name, follower) in followers) {
            assertTrue(follower.isStarted, "$name was never started: its bean wants initMethod = \"start\"")
        }
    }
}
