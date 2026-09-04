package villages.protocol

import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule

/**
 * The one place frames become text and text becomes frames. Jackson 3 with the Kotlin module; the
 * `type` discriminators are on the sealed interfaces themselves, so this needs no registry to keep in step.
 */
object ProtocolJson {
    private val mapper: JsonMapper = JsonMapper.builder()
        .addModule(KotlinModule.Builder().build())
        .build()

    fun encode(frame: ClientFrame): String = mapper.writeValueAsString(frame)

    fun encode(frame: ServerFrame): String = mapper.writeValueAsString(frame)

    fun decodeClient(json: String): ClientFrame = mapper.readValue(json, ClientFrame::class.java)

    fun decodeServer(json: String): ServerFrame = mapper.readValue(json, ServerFrame::class.java)

    /** The structure of some JSON, for comparing two texts that may differ only in spacing or order. */
    fun tree(json: String): JsonNode = mapper.readTree(json)
}
