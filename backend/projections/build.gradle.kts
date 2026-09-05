plugins {
    id("villages.kotlin-module")
}

// Read models built from durable subscriptions. The map is served from here, never from the event store.
dependencies {
    implementation(project(":application"))
    implementation(project(":domain"))
    implementation(project(":infrastructure-occurrent"))
    // The cell grid: which tile a place falls in, and how far out a thing is drawn. Decision 0026.
    implementation(project(":protocol"))
    testImplementation(libs.kotest.property)
}
