package villages.occurrent

import org.testcontainers.mongodb.MongoDBContainer

/**
 * The one MongoDB every Docker spec of this module shares: started the first time a spec asks for it, and left running
 * until the tests' JVM ends, when Testcontainers' reaper stops it. A spec that started one of its own spent ten seconds
 * or so on it (2026-10-20). Sharing is safe because the specs run one after another and each keeps to databases of
 * names of its own.
 */
object DockerStack {
    val mongo: MongoDBContainer by lazy { MongoDBContainer("mongo:8.0").withReplicaSet().also { it.start() } }
}
