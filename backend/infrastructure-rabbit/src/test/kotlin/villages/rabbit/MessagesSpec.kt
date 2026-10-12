package villages.rabbit

import com.rabbitmq.client.impl.LongStringHelper
import io.cloudevents.core.builder.CloudEventBuilder
import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import java.net.URI
import java.time.OffsetDateTime

/** A stored event, as a message carries it and back, with nothing lost on the way (decision record 0094). */
class MessagesSpec : StringSpec({
    "a stored event comes back from its message as it was written, to the nanosecond and the byte" {
        val stored = CloudEventBuilder.v1()
            .withId("4f1c9a52-0b8e-4c2d-9a7e-1f2e3d4c5b6a")
            .withSource(URI.create("urn:villages"))
            .withType("villages.house.founded.v1")
            .withSubject("6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a")
            .withTime(OffsetDateTime.parse("2026-09-04T12:00:00.123456789Z"))
            .withData("application/json", """{"name":"Ravenscar","seat":{"lat":59.33,"lon":18.07}}""".toByteArray())
            .withExtension("streamid", "house:6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a")
            .withExtension("streamversion", 1L)
            .withExtension("correlationid", "57000000-0000-4000-8000-0000000000ff")
            .withExtension("causationid", "1c000001-0000-4000-8000-00000000000a")
            .build()

        val sent = Messages.propertiesOf(stored)
        // Text comes off the wire as the client's LongString, which is what a consumer is handed.
        val received = sent.builder().headers(
            sent.headers.mapValues { (_, value) -> if (value is String) LongStringHelper.asLongString(value) else value },
        ).build()
        val read = Messages.eventOf(received, Messages.bodyOf(stored))

        read shouldBe stored
        sent.deliveryMode shouldBe 2
    }

    "a marker, which has no data, comes back without any" {
        val marker = CloudEventBuilder.v1().withId("m-1").withSource(URI.create("urn:villages"))
            .withType("villages.feed.marker").withTime(OffsetDateTime.parse("2026-10-12T20:00:00Z")).build()

        Messages.eventOf(Messages.propertiesOf(marker), Messages.bodyOf(marker)) shouldBe marker
    }
})

