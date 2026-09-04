package villages.app

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

/**
 * The one place the world boots. Everything else is a library; only this module knows about Spring Boot's
 * entry point, and the architecture tests hold it to that.
 */
@SpringBootApplication
class VillagesApplication

fun main(args: Array<String>) {
    runApplication<VillagesApplication>(*args)
}
