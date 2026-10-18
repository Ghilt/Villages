package villages.app

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.application.Islands
import villages.application.fate.GroundIslands
import villages.application.fate.GroundMaps
import villages.application.fate.PlaceNamesByMaster
import villages.application.Portraits
import villages.application.Stands
import villages.application.Shelf
import java.nio.file.Path

/**
 * What the world is drawn from on disk, in the repository beside the server: portraits, stands, ground, islands, names.
 * Every mechanic reads them, so they are wired here rather than in any one mechanic's configuration: see
 * `docs/plans/mechanic-modules.md`, step 4.
 */
@Configuration
class WorldFilesConfig {
    /**
     * Adam's portraits, from the repository's `world/portraits/`, two directories above the one Gradle runs
     * the server in. `villages.portraits` points it somewhere else.
     */
    @Bean
    fun portraits(@Value("\${villages.portraits:../../world/portraits}") folder: String): Portraits =
        FolderPortraits(Path.of(folder))

    /**
     * The scenery's stands, from the folder the world generator writes them to and nothing serves, two
     * directories above the one Gradle runs the server in, as the portraits are. `villages.stands` points it
     * somewhere else. See decision record 0067.
     */
    @Bean
    fun stands(@Value("\${villages.stands:../../world/stands}") folder: String): Stands =
        FolderStands(Path.of(folder))

    /** Each master's ground map, from the folder `world:ground` writes, as the stands are. See 0084. */
    @Bean
    fun ground(@Value("\${villages.ground:../../world/ground}") folder: String): GroundMaps =
        FolderGround(Path.of(folder))

    /** Which land is an island, read off the ground of the world's master. See decision record 0096. */
    @Bean
    fun islands(ground: GroundMaps, @Value("\${villages.master:$WORLD_MASTER}") master: String, shelf: Shelf): Islands =
        GroundIslands(ground, master) { shelf.balance }

    /** Each master's real names, from the copy `world:names` files beside its ground map. See 0087. */
    @Bean
    fun placeNames(@Value("\${villages.ground:../../world/ground}") folder: String): PlaceNamesByMaster =
        FolderNames(Path.of(folder))
}
