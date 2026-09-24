package villages.projections

import villages.application.CharacterMapChange
import villages.application.CharacterRow
import villages.application.CharacterSpan
import villages.application.CharactersByCell
import villages.application.CharactersInCell
import villages.application.EventFeed
import villages.application.Holder
import villages.application.KeyFiguresByHouse
import villages.application.KeyFiguresChange
import villages.application.PlacedCharacter
import villages.application.Start
import villages.application.StoredEvent
import villages.domain.Banner
import villages.domain.CharacterAged
import villages.domain.CharacterAppeared
import villages.domain.CharacterDied
import villages.domain.CharacterId
import villages.domain.CharacterLeftTheMap
import villages.domain.CharacterMoved
import villages.domain.CharacterPortraitChanged
import villages.domain.CharacterStatChanged
import villages.domain.HouseFounded
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseId
import villages.domain.HouseLostKeyFigure
import villages.domain.HouseName
import villages.domain.PlayerId
import villages.domain.WorldTime
import villages.protocol.Cell
import villages.protocol.coarsestZoom
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.atomic.AtomicLong

/**
 * The characters, folded from the feed, and which of them each house holds.
 *
 * Two kinds of stream meet here. A character's own stream says who they are and what has happened to them;
 * the houses' streams say who holds whom. The row carries both, so a view of a key figure needs nothing
 * else, and the reverse index - the houses a character is held by - is what lets a change to one person's
 * record reach the player of every house holding them. See decision record 0055.
 *
 * A house's ties are kept apart from the rows, so a tie that arrives before its character, which a race can
 * make, is kept and filled in when they appear. A dead character leaves every house's list at once, the
 * moment they die, rather than when the mourning's loss lands: a dead key figure leaves the grid.
 *
 * **Where they stood is spans**, one for each stretch of world-time a character stood in one place, closed
 * by a move, by leaving the map or by dying. A cell at a moment is then the span that holds that day, which
 * is how the houses' map is asked too; a character who moves would otherwise stay drawn in a cell they left.
 *
 * Disposable, like every read model: delete it, replay the feed, get it back.
 */
class CharactersProjection(feed: EventFeed) : KeyFiguresByHouse, CharactersByCell, AutoCloseable {
    private class HouseFacts(val player: PlayerId, val name: HouseName, val banner: Banner)

    /** A span with the deepest cell its place falls in and the coarsest zoom it is drawn at, worked out once. */
    private class Indexed(val span: CharacterSpan, val quadkey: String, val coarsestZoom: Int)

    private val characters = ConcurrentHashMap<CharacterId, CharacterRow>()
    private val ties = ConcurrentHashMap<HouseId, CopyOnWriteArrayList<CharacterId>>()
    private val holders = ConcurrentHashMap<CharacterId, CopyOnWriteArrayList<HouseId>>()
    private val houses = ConcurrentHashMap<HouseId, HouseFacts>()
    private val listeners = CopyOnWriteArraySet<(KeyFiguresChange) -> Unit>()
    private val spans = ConcurrentHashMap<CharacterId, CopyOnWriteArrayList<Indexed>>()
    private val mapListeners = CopyOnWriteArraySet<(CharacterMapChange) -> Unit>()
    private val revisions = AtomicLong()

    // From the beginning: a read model is its fold of every event. See decision record 0029.
    private val subscription: AutoCloseable = feed.subscribe(Start.FROM_THE_BEGINNING, ::apply)

    internal fun apply(stored: StoredEvent) {
        when (val event = stored.event) {
            is HouseFounded -> houses[event.houseId] = HouseFacts(event.player, event.name, event.banner)

            is HouseGainedKeyFigure -> {
                ties.getOrPut(event.houseId) { CopyOnWriteArrayList() }.addIfAbsent(event.characterId)
                holders.getOrPut(event.characterId) { CopyOnWriteArrayList() }.addIfAbsent(event.houseId)
                changed(event.characterId) { it.copy(keyFigureOf = holdersOf(event.characterId)) }
                tell(event.houseId)
            }

            is HouseLostKeyFigure -> {
                ties[event.houseId]?.remove(event.characterId)
                holders[event.characterId]?.remove(event.houseId)
                changed(event.characterId) { it.copy(keyFigureOf = holdersOf(event.characterId)) }
                tell(event.houseId)
            }

            is CharacterAppeared -> {
                characters[event.characterId] = CharacterRow(
                    id = event.characterId,
                    name = event.name,
                    sex = event.sex,
                    species = event.species,
                    bornOn = event.bornOn,
                    agedYears = 0,
                    stats = event.stats,
                    portrait = event.portrait,
                    appearedOn = event.worldTime,
                    diedOn = null,
                    keyFigureOf = holdersOf(event.characterId),
                    revision = revisions.incrementAndGet(),
                )
                tellHoldersOf(event.characterId)
            }

            is CharacterStatChanged -> {
                changed(event.characterId) { it.copy(stats = it.stats + (event.stat to event.value)) }
                tellHoldersOf(event.characterId)
            }

            is CharacterAged -> {
                changed(event.characterId) { it.copy(agedYears = it.agedYears + event.years) }
                tellHoldersOf(event.characterId)
            }

            is CharacterPortraitChanged -> {
                changed(event.characterId) { it.copy(portrait = event.portrait) }
                tellHoldersOf(event.characterId)
            }

            is CharacterDied -> {
                // They are on no map from the day they die, and no `leftTheMap` is written to say so.
                changed(event.characterId) { it.copy(diedOn = event.worldTime, place = null) }
                moveOnTheMap(event.characterId, to = null, on = event.worldTime)
                tellHoldersOf(event.characterId)
            }

            // The row first, at a new revision, so what the map is told is the newest copy of them.
            is CharacterMoved -> {
                changed(event.characterId) { it.copy(place = event.place) }
                moveOnTheMap(
                    event.characterId,
                    to = CharacterSpan(event.place, event.significance, since = event.worldTime, until = null),
                    on = event.worldTime,
                )
                tellHoldersOf(event.characterId)
            }

            is CharacterLeftTheMap -> {
                changed(event.characterId) { it.copy(place = null) }
                moveOnTheMap(event.characterId, to = null, on = event.worldTime)
                tellHoldersOf(event.characterId)
            }

            // What a house has, and what it is asked, are other read models' business.
            else -> Unit
        }
    }

    /**
     * Closes the span a character stood in, on the day they moved or left, and opens the one they stand in
     * now, if any; then tells whoever is watching the map where they were and where they are.
     */
    private fun moveOnTheMap(id: CharacterId, to: CharacterSpan?, on: WorldTime) {
        val stood = spans.getOrPut(id) { CopyOnWriteArrayList() }
        val open = stood.lastOrNull()?.takeIf { it.span.until == null }
        val was = open?.span?.copy(until = on)
        if (open != null && was != null) {
            stood[stood.lastIndex] = Indexed(was, open.quadkey, open.coarsestZoom)
        }
        if (to != null) {
            stood += Indexed(to, Cell.of(to.place.lat, to.place.lon).quadkey, coarsestZoom(to.significance.value))
        }
        val row = characters[id] ?: return
        if (was == null && to == null) {
            return
        }
        val change = CharacterMapChange(row, was, to)
        for (listener in mapListeners) {
            listener(change)
        }
    }

    /** The row with one change made, at a new revision; nothing when the character never appeared. */
    private fun changed(id: CharacterId, change: (CharacterRow) -> CharacterRow) {
        characters.computeIfPresent(id) { _, row -> change(row).copy(revision = revisions.incrementAndGet()) }
    }

    /** The houses holding a character, in the order they took them in: the first is whose colours they wear. */
    private fun holdersOf(id: CharacterId): List<Holder> =
        holders[id].orEmpty().mapNotNull { house -> houses[house]?.let { Holder(house, it.name, it.banner) } }

    private fun tellHoldersOf(id: CharacterId) {
        holders[id].orEmpty().forEach(::tell)
    }

    private fun tell(house: HouseId) {
        val player = houses[house]?.player ?: return
        val change = KeyFiguresChange(house, player, of(house))
        for (listener in listeners) {
            listener(change)
        }
    }

    override fun of(house: HouseId): List<CharacterRow> =
        ties[house].orEmpty().mapNotNull { characters[it] }.filter { it.diedOn == null }

    override fun watch(listener: (KeyFiguresChange) -> Unit): AutoCloseable {
        listeners += listener
        return AutoCloseable { listeners -= listener }
    }

    override fun inCell(cell: String, at: WorldTime, most: Int, everything: Boolean): CharactersInCell {
        val zoom = cell.length
        val standing = spans.entries
            .mapNotNull { (id, stood) ->
                val here = stood.firstOrNull { it.span.covers(at) } ?: return@mapNotNull null
                val row = characters[id] ?: return@mapNotNull null
                if (here.quadkey.startsWith(cell) && (everything || here.coarsestZoom <= zoom)) {
                    PlacedCharacter(row, here.span)
                } else {
                    null
                }
            }
            .sortedWith(
                compareByDescending<PlacedCharacter> { it.span.significance.value }.thenBy { it.row.id.value },
            )
        return CharactersInCell(standing.take(most), (standing.size - most).coerceAtLeast(0))
    }

    override fun watchTheMap(listener: (CharacterMapChange) -> Unit): AutoCloseable {
        mapListeners += listener
        return AutoCloseable { mapListeners -= listener }
    }

    /** Every character the read model knows of, alive or dead, for the debug panel and for tests. */
    val size: Int get() = characters.size

    /**
     * Forgets everyone, because the world they were in has been emptied. The revision keeps climbing, so a
     * client that held a row from before cannot mistake a new one for it. See decision record 0036.
     */
    fun reset() {
        characters.clear()
        ties.clear()
        holders.clear()
        houses.clear()
        spans.clear()
    }

    override fun close() {
        subscription.close()
    }
}
