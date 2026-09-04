plugins {
    id("villages.kotlin-module")
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

// The one module that boots. It wires everything and holds the only @SpringBootApplication; arch-tests
// fails if another appears.
dependencies {
    implementation(platform(libs.spring.boot.dependencies))
    implementation(libs.spring.boot.starter)
    implementation(libs.spring.boot.starter.websocket)
    implementation(project(":domain"))
    implementation(project(":application"))
    implementation(project(":protocol"))
    implementation(project(":infrastructure-occurrent"))
    implementation(project(":infrastructure-rabbit"))
    implementation(project(":projections"))
    implementation(project(":gateway"))
    testImplementation(libs.spring.boot.starter.test)
}
