plugins {
    id("villages.kotlin-module")
}

// The frames that cross the WebSocket, mirrored in TypeScript under frontend/packages/protocol and tested
// against the same fixtures in contracts/fixtures. Depends on no other module, so a frame can never leak a
// domain type by accident. Its one third-party dependency is Jackson 3, because a wire format needs a JSON
// library and this is the project's; the version is Spring Boot's.
dependencies {
    // api, not implementation: EventFrame carries its data as a JsonNode, so whoever handles frames sees
    // Jackson's node type. The Kotlin module is the codec's own business.
    api(platform(libs.spring.boot.dependencies))
    api(libs.jackson.databind)
    implementation(libs.jackson.module.kotlin)
    // The cell grid is arithmetic over every place in the world, so it is checked over every place.
    testImplementation(libs.kotest.property)
    // The shape of the wire is read off the sealed hierarchies themselves, so nothing can be left out.
    testImplementation(kotlin("reflect"))
}

tasks.test {
    // Recording the wire is a deliberate act, and the switch has to reach the test's own JVM to do it.
    systemProperty("protocol.record", providers.systemProperty("protocol.record").getOrElse("false"))
}
