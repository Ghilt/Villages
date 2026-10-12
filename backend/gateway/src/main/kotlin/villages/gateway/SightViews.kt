package villages.gateway

import villages.application.Sight
import villages.application.VisionSource
import villages.protocol.Point
import villages.protocol.VisionPointView

/**
 * A house's vision points as the page draws its fog from them: every one it has had, oldest first. The
 * radius stays in kilometres; how big that is on the map is the page's to work out. See decision 0061.
 */
internal fun Sight.toView(): List<VisionPointView> = points.map { point ->
    VisionPointView(
        kind = when (point.source) {
            is VisionSource.KeyFigure -> "keyFigure"
            is VisionSource.Given -> "given"
        },
        of = when (val source = point.source) {
            is VisionSource.KeyFigure -> source.character.value.toString()
            is VisionSource.Given -> source.vision.value.toString()
        },
        place = Point(point.place.lat, point.place.lon),
        radius = point.radius,
        since = point.since.day,
        until = point.until?.day,
        from = point.from?.value?.toString(),
    )
}
