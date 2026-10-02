package villages.gateway

import villages.application.StoredEvent
import villages.protocol.EventFrame
import villages.protocol.ProtocolJson

internal fun StoredEvent.toFrame(): EventFrame = EventFrame(
    id = id,
    eventType = type,
    stream = stream,
    streamVersion = streamVersion,
    time = time.toEpochMilli(),
    correlationId = correlationId,
    causationId = causationId,
    data = ProtocolJson.tree(data),
)
