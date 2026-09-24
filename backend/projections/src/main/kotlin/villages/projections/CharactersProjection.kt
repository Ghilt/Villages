package villages.projections

import villages.application.CharacterRow
import villages.application.EventFeed
import villages.application.Holder
import villages.application.KeyFiguresByHouse
import villages.application.KeyFiguresChange
import villages.application.Start
import villages.application.StoredEvent
import villages.domain.Banner
import villages.domain.CharacterAged
import villages.domain.CharacterAppeared
import villages.domain.CharacterDied
import villages.domain.CharacterId
import villages.domain.CharacterPortraitChanged
import villages.domain.CharacterStatChanged
import villages.domain.HouseFounded
import villages.domain.HouseGainedKeyFigure
import villages.domain.HouseId
import villages.domain.HouseLostKeyFigure
import villages.domain.HouseName
import villages.domain.PlayerId
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
 * Disposable, like every read model: delete it, replay the feed, get it back.
 */
class CharactersProjection(feed: EventFeed) : KeyFiguresByHouse, AutoCloseable {
    private class HouseFacts(val player: PlayerId, val name: HouseName, val banner: Banner)

    private val characters = ConcurrentHashMap<CharacterId, CharacterRow>()
    private val ties = ConcurrentHashMap<HouseId, CopyOnWriteArrayList<CharacterId>>()
    private val holders = ConcurrentHashMap<CharacterId, CopyOnWriteArrayList<HouseId>>()
    private val houses = ConcurrentHashMap<HouseId, HouseFacts>()
    private val listeners = CopyOnWriteArraySet<(KeyFiguresChange) -> Unit>()
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
                changed(event.characterId) { it.copy(diedOn = event.worldTime) }
                tellHoldersOf(event.characterId)
            }

            // What a house has, and what it is asked, are other read models' business.
            else -> Unit
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
    }

    override fun close() {
        subscription.close()
    }
}
