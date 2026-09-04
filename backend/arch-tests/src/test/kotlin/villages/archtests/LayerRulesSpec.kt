package villages.archtests

import com.tngtech.archunit.core.domain.JavaClasses
import com.tngtech.archunit.core.importer.ClassFileImporter
import com.tngtech.archunit.core.importer.ImportOption
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses
import com.tngtech.archunit.library.Architectures.layeredArchitecture
import com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices
import io.kotest.core.spec.style.StringSpec

/**
 * The layer rules of docs/ARCHITECTURE.md, as tests.
 *
 * Gradle's module edges already stop a module importing what it does not depend on. These catch what the
 * edges cannot: a class put in the wrong package of the right module, a second application entry point,
 * a cycle between slices. Together they are the whole enforcement; see decision record 0001 and the
 * dependency rules in the architecture document.
 *
 * Only production classes are held to the rules. Tests may depend on whatever they need to test with.
 */
class LayerRulesSpec : StringSpec({

    val world: JavaClasses = ClassFileImporter()
        .withImportOption(ImportOption.DoNotIncludeTests())
        .importPackages("villages")

    /**
     * What Kotlin itself puts in every class: the standard library, the JDK, and the nullability
     * annotations the compiler writes onto public signatures for Java's benefit. Nothing else is free.
     */
    val standardLibrary = arrayOf("kotlin..", "java..", "org.jetbrains.annotations..")

    "the domain depends on the Kotlin standard library and nothing else" {
        noClasses()
            .that().resideInAPackage("villages.domain..")
            .should().dependOnClassesThat().resideOutsideOfPackages("villages.domain..", *standardLibrary)
            .because("the game rules must know nothing of Spring, Occurrent, MongoDB, RabbitMQ or Jackson")
            .check(world)
    }

    "the application depends only on the domain" {
        noClasses()
            .that().resideInAPackage("villages.application..")
            .should().dependOnClassesThat()
            .resideOutsideOfPackages("villages.application..", "villages.domain..", *standardLibrary)
            .because("use cases own the ports; infrastructure implements them from the other side")
            .check(world)
    }

    "each layer is reached only from the layers above it" {
        layeredArchitecture()
            .consideringOnlyDependenciesInLayers()
            .layer("Domain").definedBy("villages.domain..")
            .layer("Application").definedBy("villages.application..")
            .layer("Protocol").definedBy("villages.protocol..")
            .layer("Occurrent").definedBy("villages.occurrent..")
            .layer("Rabbit").definedBy("villages.rabbit..")
            .layer("Projections").definedBy("villages.projections..")
            .layer("Gateway").definedBy("villages.gateway..")
            .layer("App").definedBy("villages.app..")
            .layer("Bots").definedBy("villages.bots..")
            .whereLayer("Domain").mayOnlyBeAccessedByLayers("Application", "Occurrent", "Rabbit", "Projections", "App")
            .whereLayer("Application").mayOnlyBeAccessedByLayers("Occurrent", "Rabbit", "Projections", "Gateway", "App")
            .whereLayer("Protocol").mayOnlyBeAccessedByLayers("Gateway", "App", "Bots")
            .whereLayer("Occurrent").mayOnlyBeAccessedByLayers("Rabbit", "Projections", "App")
            .whereLayer("Rabbit").mayOnlyBeAccessedByLayers("Gateway", "App")
            .whereLayer("Projections").mayOnlyBeAccessedByLayers("App")
            .whereLayer("Gateway").mayOnlyBeAccessedByLayers("App")
            .whereLayer("App").mayNotBeAccessedByAnyLayer()
            .whereLayer("Bots").mayNotBeAccessedByAnyLayer()
            .check(world)
    }

    "no two slices depend on each other" {
        slices()
            .matching("villages.(*)..")
            .should().beFreeOfCycles()
            .check(world)
    }

    "only the app module boots" {
        classes()
            .that().areAnnotatedWith("org.springframework.boot.autoconfigure.SpringBootApplication")
            .should().resideInAPackage("villages.app..")
            .because("one process boots the world; the gateway is written as if separate but is not yet")
            .check(world)
    }
})
