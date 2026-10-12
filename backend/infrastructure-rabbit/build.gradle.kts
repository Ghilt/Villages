plugins {
    id("villages.kotlin-module")
}

// The broker topology and the bridge from the event store to the exchange, on RabbitMQ's own Java client, as the
// store is on MongoDB's own driver. Every AMQP type lives in this module and nowhere else. See decision 0094.
dependencies {
    implementation(project(":application"))
    implementation(project(":domain"))
    implementation(project(":infrastructure-occurrent"))

    implementation(platform(libs.spring.boot.dependencies))
    implementation(libs.amqp.client)

    // Every event that says where it happened is routed by it: the spec walks the events to hold that.
    testImplementation(kotlin("reflect"))
    // A RabbitMQ and a MongoDB of the test's own, thrown away after it, for the specs that say they need Docker.
    testImplementation(libs.testcontainers.rabbitmq)
    testImplementation(libs.testcontainers.mongodb)
}
