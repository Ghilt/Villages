plugins {
    id("villages.kotlin-module")
}

// The event store, the CloudEvent type mapper and the subscriptions, all behind the ports application
// declares. Every Occurrent type lives in this module and nowhere else.
dependencies {
    implementation(project(":application"))
    implementation(project(":domain"))
    implementation(platform(libs.occurrent.bom))
}
