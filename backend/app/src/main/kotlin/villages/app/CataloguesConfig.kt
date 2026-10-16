package villages.app

import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Shelf
import villages.application.WorldClock
import villages.occurrent.EventWorld
import java.nio.file.Path
import java.time.Clock

/**
 * The catalogues, wired: the folder they are read from, `world/catalogues/` or `villages.catalogues`, and the shelf
 * that records on the world's own stream every version of one it takes on, as the server starts and again after a
 * wipe. See docs/plans/catalogues.md and decision record 0097.
 */
@Configuration
class CataloguesConfig {
    @Bean
    fun catalogueFiles(@Value("\${villages.catalogues:../../world/catalogues}") folder: String): FolderCatalogues =
        FolderCatalogues(Path.of(folder))

    @Bean
    fun shelf(files: FolderCatalogues, world: EventWorld, clock: Clock, worldClock: WorldClock): Shelf =
        Shelf(files, world.worldExecutor(CatalogueDiff::changes), { clock.instant() }, worldClock)

    /** The world's record of what it runs on, written as the server starts. */
    @Bean
    fun recordCatalogues(shelf: Shelf): ApplicationRunner = ApplicationRunner { shelf.recordAll() }
}
