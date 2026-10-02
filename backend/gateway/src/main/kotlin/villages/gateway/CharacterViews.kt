package villages.gateway

import villages.application.CharacterRow
import villages.application.CharacterSpan
import villages.domain.Stat
import villages.protocol.Cell
import villages.protocol.CharacterOnMapView
import villages.protocol.HolderView
import villages.protocol.KeyFigureView
import villages.protocol.Point
import villages.protocol.StatsView

/**
 * A key figure as the pane shows them: the whole row, with the stats, because this goes to the session of a
 * house that holds them and to nobody else. See decision record 0055.
 */
internal fun CharacterRow.toView(): KeyFigureView = KeyFigureView(
    id = id.value.toString(),
    givenName = name.given,
    familyName = name.family,
    sex = sex.name.lowercase(),
    species = species.name.lowercase(),
    bornOn = bornOn.day,
    agedYears = agedYears,
    stats = StatsView(
        piety = stats.getValue(Stat.PIETY),
        reason = stats.getValue(Stat.REASON),
        kindness = stats.getValue(Stat.KINDNESS),
        physical = stats.getValue(Stat.PHYSICAL),
    ),
    portrait = portrait,
    keyFigureOf = keyFigureOf.map { HolderView(it.house.value.toString(), it.name.value, it.banner.toWire()) },
    place = place?.let { Point(it.lat, it.lon) },
    version = revision,
)

/**
 * A character standing on the map as everyone holding the cell sees them: who and whose, how old and
 * where, and not the stats, which are their house's own. The span is where they stood on the day the map was asked about.
 */
internal fun CharacterRow.toMapView(span: CharacterSpan): CharacterOnMapView = CharacterOnMapView(
    id = id.value.toString(),
    givenName = name.given,
    familyName = name.family,
    sex = sex.name.lowercase(),
    species = species.name.lowercase(),
    bornOn = bornOn.day,
    agedYears = agedYears,
    portrait = portrait,
    place = Point(span.place.lat, span.place.lon),
    cell = Cell.of(span.place.lat, span.place.lon).quadkey,
    keyFigureOf = keyFigureOf.map { HolderView(it.house.value.toString(), it.name.value, it.banner.toWire()) },
    since = span.since.day,
    version = revision,
)
