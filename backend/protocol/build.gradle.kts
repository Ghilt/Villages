plugins {
    id("villages.kotlin-module")
}

// The frames that cross the WebSocket, mirrored in TypeScript under frontend/packages/protocol and tested
// against the same fixtures in contracts/fixtures. Depends on no other module, so a frame can never leak a
// domain type by accident. Its one third-party dependency is Jackson 3, because a wire format needs a JSON
// library and this is the project's; the version is Spring Boot's.
dependencies {
    implementation(platform(libs.spring.boot.dependencies))
    implementation(libs.jackson.databind)
    implementation(libs.jackson.module.kotlin)
}
