package villages.app

import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Fault
import villages.application.Faults
import villages.application.Shelf
import villages.application.WorldClock
import villages.occurrent.EventWorld
import java.nio.file.Path
import java.time.Clock
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * The catalogues, wired: the folder they are read from, `world/catalogues/` or `villages.catalogues`; the shelf that
 * reads them as the server starts, and will not let it start on one it cannot read; and, while
 * `villages.catalogues.editable` is on, as it is unless a released server turns it off, a look at the folder twice a
 * second, so a file saved by hand is taken on while the server runs. See docs/plans/catalogues.md and 0097.
 */
@Configuration
class CataloguesConfig {
    @Bean
    fun catalogueFiles(@Value("\${villages.catalogues:../../world/catalogues}") folder: String): FolderCatalogues =
        FolderCatalogues(Path.of(folder))

    @Bean(initMethod = "start")
    fun shelf(
        files: FolderCatalogues,
        world: EventWorld,
        clock: Clock,
        worldClock: WorldClock,
        faults: Faults,
        @Value("\${villages.catalogues.editable:true}") editable: Boolean,
    ): Shelf = Shelf(
        files = files,
        reader = ShelfReader,
        world = world.worldExecutor(CatalogueDiff::changes),
        clock = { clock.instant() },
        worldClock = worldClock,
        faults = faults,
        format = CatalogueText::format,
        editable = editable,
    )

    /** One thread, a daemon, for looking at the folder. */
    @Bean(destroyMethod = "shutdownNow")
    fun shelfWatch(): ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor { run ->
        Thread(run, "the shelf's watch").apply { isDaemon = true }
    }

    /** The folder looked at once everything is following the feed, so a change is set right by everything. */
    @Bean
    fun watchShelf(shelf: Shelf, shelfWatch: ScheduledExecutorService, faults: Faults): ApplicationRunner = ApplicationRunner {
        if (shelf.editable) {
            shelfWatch.scheduleWithFixedDelay(
                {
                    try {
                        shelf.refresh()
                    } catch (@Suppress("TooGenericExceptionCaught") thrown: RuntimeException) {
                        faults.report(Fault("the shelf", "world/catalogues/", thrown))
                    }
                },
                LOOK_EVERY_MS,
                LOOK_EVERY_MS,
                TimeUnit.MILLISECONDS,
            )
        }
    }

    private companion object {
        const val LOOK_EVERY_MS = 500L
    }
}
