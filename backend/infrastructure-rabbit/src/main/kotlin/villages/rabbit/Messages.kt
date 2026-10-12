package villages.rabbit

import com.rabbitmq.client.AMQP
import io.cloudevents.CloudEvent
import io.cloudevents.core.builder.CloudEventBuilder
import java.net.URI
import java.time.OffsetDateTime

/**
 * What a message carries: a stored event, as the store holds it (decision record 0094). The body is its data byte
 * for byte; its id is the message's id and its type the message's type; its source, subject and time, the time as
 * the text it was written as, to the nanosecond (0074), and every extension - the stream and its version, the story
 * and what caused it (0035) - are headers, under the names Occurrent writes them. Not the CloudEvents JSON format,
 * whose module is on Jackson 2.
 *
 * Persistent, so that a queue that outlives the broker's restart keeps what it was given.
 */
internal object Messages {
    private const val SOURCE = "source"
    private const val SUBJECT = "subject"
    private const val TIME = "time"
    private const val PERSISTENT = 2

    fun propertiesOf(event: CloudEvent): AMQP.BasicProperties {
        val headers = HashMap<String, Any>()
        headers[SOURCE] = event.source.toString()
        event.subject?.let { headers[SUBJECT] = it }
        event.time?.let { headers[TIME] = it.toString() }
        event.extensionNames.forEach { name ->
            event.getExtension(name)?.let { headers[name] = if (it is Number || it is Boolean) it else it.toString() }
        }
        return AMQP.BasicProperties.Builder()
            .messageId(event.id)
            .type(event.type)
            .contentType(event.dataContentType)
            .deliveryMode(PERSISTENT)
            .headers(headers)
            .build()
    }

    fun bodyOf(event: CloudEvent): ByteArray = event.data?.toBytes() ?: ByteArray(0)

    /** The stored event a message carries, as it was written. */
    fun eventOf(properties: AMQP.BasicProperties, body: ByteArray): CloudEvent {
        val headers = properties.headers.orEmpty()
        val event = CloudEventBuilder.v1()
            .withId(properties.messageId)
            .withType(properties.type)
            .withSource(URI.create(headers.getValue(SOURCE).toString()))
        headers[SUBJECT]?.let { event.withSubject(it.toString()) }
        headers[TIME]?.let { event.withTime(OffsetDateTime.parse(it.toString())) }
        if (body.isNotEmpty()) event.withData(properties.contentType, body)
        headers.filterKeys { it !in setOf(SOURCE, SUBJECT, TIME) }.forEach { (name, value) ->
            // A number and a yes or no come back as they went, and text comes back as the client's LongString.
            when (value) {
                is Number -> event.withExtension(name, value)
                is Boolean -> event.withExtension(name, value)
                else -> event.withExtension(name, value.toString())
            }
        }
        return event.build()
    }
}
