package villages.app

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import villages.domain.StructureCatalogue
import java.nio.file.Files
import java.nio.file.Path

/**
 * Structures, wired: the catalogue of their types, read once when the server starts from `world/structures.json`, or
 * from `villages.structures`. A configuration of its own rather than more of `WorldConfig`, so that structures grow
 * here. See docs/plans/structures.md and decision record 0092.
 */
@Configuration
class StructuresConfig {
    @Bean
    fun structureCatalogue(@Value("\${villages.structures:../../world/structures.json}") file: String): StructureCatalogue =
        StructureCatalogueFile.parse(Files.readString(Path.of(file)))
}
