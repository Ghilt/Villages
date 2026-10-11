plugins {
    id("villages.kotlin-module")
}

// The event store, the CloudEvent type mapper and the subscriptions, all behind the ports application
// declares. Every Occurrent type lives in this module and nowhere else.
dependencies {
    implementation(project(":application"))
    implementation(project(":domain"))

    // Occurrent's BOM pins its own artifacts; Spring Boot's pins Jackson 3 and everything else. Both are
    // here on purpose, because whether the two agree is exactly what increment 0.7 finds out.
    implementation(platform(libs.occurrent.bom))
    implementation(platform(libs.spring.boot.dependencies))
    implementation(libs.occurrent.eventstore.api)
    implementation(libs.occurrent.converter.jackson3)
    // The executor builds its own envelopes, so the CloudEvent builder is ours to name. See 0035.
    implementation(libs.cloudevents.core)
    implementation(libs.jackson.module.kotlin)
    implementation(libs.occurrent.subscription.api)
    // In memory for the tests and whenever the app is not told otherwise.
    implementation(libs.occurrent.eventstore.inmemory)
    implementation(libs.occurrent.subscription.inmemory)
    // In MongoDB when the app is told to keep its world there, behind the same ports. See decision 0091.
    implementation(libs.occurrent.eventstore.mongodb)
    implementation(libs.occurrent.subscription.mongodb)

    // Occurrent's application service and its decider DSL: what the executor used to be built on, kept
    // for the smoke test of increment 0.7, which still proves the library works as the plan assumed.
    testImplementation(libs.occurrent.application.service)
    testImplementation(libs.occurrent.decider)

    // A MongoDB of the test's own, thrown away after it, for the specs that say they need Docker.
    testImplementation(libs.testcontainers.mongodb)
}

// One stored event for every catalogued type, and the catalogue that lists the types.
testsRead("contracts/fixtures/events", "docs/EVENTS.md")
