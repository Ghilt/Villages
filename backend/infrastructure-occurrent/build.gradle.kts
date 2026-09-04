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
    implementation(libs.occurrent.application.service)
    implementation(libs.occurrent.decider)
    implementation(libs.occurrent.converter.jackson3)
    implementation(libs.jackson.module.kotlin)

    // The in-memory store is for tests. The real one arrives with MongoDB in 0.8.
    testImplementation(libs.occurrent.eventstore.inmemory)
}
