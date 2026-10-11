package villages.gateway

import villages.application.DialogueService
import villages.application.EventFeed
import villages.application.FoundHouseService
import villages.application.KeyFigureService
import villages.application.RecentEvents
import villages.application.ResourceService
import villages.application.Start
import villages.application.StoredEvent
import villages.application.Unreadable
import villages.application.VisionService
import villages.application.WorldKept
import villages.application.WorldWipe
import villages.application.fate.RollService
import villages.domain.CharacterId
import villages.domain.HouseId
import villages.domain.HouseName
import villages.domain.PlayerId
import villages.domain.Location
import villages.domain.PledgeId
import villages.domain.VisionId
import villages.protocol.AddKeyFigurePayload
import villages.protocol.AgeCharacterPayload
import villages.protocol.ChangePortraitPayload
import villages.protocol.ChangeStatPayload
import villages.protocol.CommandPayload
import villages.protocol.ErrorFrame
import villages.protocol.FogOfWar
import villages.protocol.FoundHousePayload
import villages.protocol.GiveVisionPayload
import villages.protocol.GrantResourcePayload
import villages.protocol.KillCharacterPayload
import villages.protocol.MoveCharacterPayload
import villages.protocol.NextRarityPayload
import villages.protocol.OfferDialoguePayload
import villages.protocol.PledgeResourcePayload
import villages.protocol.ReleasePledgePayload
import villages.protocol.ConsideredView
import villages.protocol.RollDrawn
import villages.protocol.SeeAll
import villages.protocol.SpendResourcePayload
import villages.protocol.TakeOffTheMapPayload
import villages.protocol.TakeVisionPayload
import villages.protocol.WatchEvents
import villages.protocol.WipeWorld
import villages.protocol.WorldWiped
import java.util.concurrent.ConcurrentHashMap

/**
 * How much of the end of the chronicle a watcher is given when it starts watching.
 *
 * A viewer that has just been opened has missed everything, and the world did not begin when it did.
 * What is served is whatever the read model still holds, so asking for more than it keeps is harmless.
 */
const val MOST_RECENT_EVENTS = 100

/** A lever pulled, or a look asked for, on a server whose instruments are closed. */
internal class InstrumentsClosed : RuntimeException("the instruments are closed on this server")

/**
 * Adam's instruments, as one part of the gateway: the fifteen levers of the debug panel and the event page, which
 * stand in for what the world will one day do, and the four frames that look at the world rather than play in
 * it - watching every event as it is stored, seeing everything whatever its significance, lifting the fog, and
 * emptying the world.
 *
 * One setting closes all of them, `villages.instruments`. Open, as it is by default, they are what they always
 * were. Closed, every lever is refused `instrumentsClosed` and each of the four frames is answered with an error
 * of that code, while the player's own commands go on as before. The event page watches without saying hello, so
 * nothing about a player is asked of a look. See decision record 0076.
 */
@Suppress("LongParameterList")
internal class Instruments(
    val open: Boolean,
    private val core: Core,
    events: EventFeed,
    private val recent: RecentEvents,
    private val emptyTheWorld: WorldWipe,
    private val foundHouse: FoundHouseService,
    private val resources: ResourceService,
    private val keyFigures: KeyFigureService,
    private val visions: VisionService,
    private val dialogues: DialogueService,
    private val rolls: RollService,
    private val kept: WorldKept,
) : Part {
    private val watching = ConcurrentHashMap.newKeySet<Gateway.Connection>()

    // From now: the debug panel watches the world happening, and would not thank us for the whole
    // chronicle replayed at it on every connect.
    private val feed: AutoCloseable = events.subscribe(Start.FROM_NOW) { stored -> tellWatchers(stored) }

    // What a roll drew from goes to the roller's own panel: the pools are never the player's to see, so it is said
    // only while the instruments are open.
    private val drawn: AutoCloseable = rolls.watch { player, rolled, forced ->
        if (open) {
            core.sessionOf(player)?.out?.send(
                RollDrawn(
                    opened = rolled.opened,
                    considered = rolled.considered.map { ConsideredView(it.action, it.weight) },
                    rarity = rolled.rarity.toWire(),
                    forced = forced,
                ),
            )
        }
    }

    /**
     * A window arriving is told what the world holds that this code cannot read, while the instruments are open: what
     * went wrong as the server started was said before any window was there to hear it. See decision record 0036.
     */
    override fun greet(connection: Gateway.Connection, who: PlayerId) {
        val unreadable = kept.unreadable()
        if (open && !unreadable.none) connection.out.send(ErrorFrame("unreadableEvents", told(unreadable)))
    }

    /**
     * The levers, each a command like any other, and the four looks, each a frame: every one of them refused
     * while the instruments are closed.
     */
    override fun register(commands: Commands, frames: Frames) {
        frames.on<WatchEvents> { connection, frame -> watchEvents(connection, frame.on) }
        frames.on<SeeAll> { connection, frame -> seeAll(connection, frame.on) }
        frames.on<FogOfWar> { connection, frame -> fogOfWar(connection, frame.on) }
        frames.on<WipeWorld> { connection, _ -> wipe(connection) }
        levers(commands)
    }

    private fun levers(commands: Commands) {
        lever<FoundHousePayload>(commands) { asking, payload ->
            foundHouse.found(
                houseId = HouseId.of(asking.who),
                player = asking.who,
                name = HouseName.of(payload.name),
                seat = Location(payload.seat.lat, payload.seat.lon),
                banner = payload.banner.toDomain(),
                provenance = asking.startingAStory,
            )
        }
        lever<GrantResourcePayload>(commands) { asking, payload ->
            resources.grant(
                player = asking.who,
                resource = asResource(payload.resource),
                amount = payload.amount,
                provenance = asking.startingAStory,
            )
        }
        lever<SpendResourcePayload>(commands) { asking, payload ->
            resources.spend(
                player = asking.who,
                resource = asResource(payload.resource),
                amount = payload.amount,
                provenance = asking.startingAStory,
            )
        }
        lever<PledgeResourcePayload>(commands) { asking, payload ->
            resources.pledge(
                player = asking.who,
                resource = asResource(payload.resource),
                amount = payload.amount,
                months = payload.months,
                purpose = payload.purpose,
                provenance = asking.startingAStory,
            )
        }
        lever<ReleasePledgePayload>(commands) { asking, payload ->
            resources.release(
                player = asking.who,
                pledgeId = PledgeId(asUuid(payload.pledgeId, "a pledge id")),
                provenance = asking.startingAStory,
            )
        }
        keyFigureLevers(commands)
        // A place off the world is refused by the place itself, as `invalidLocation`.
        lever<GiveVisionPayload>(commands) { asking, payload ->
            visions.give(
                player = asking.who,
                place = Location(payload.place.lat, payload.place.lon),
                provenance = asking.startingAStory,
            )
        }
        lever<TakeVisionPayload>(commands) { asking, payload ->
            visions.take(
                player = asking.who,
                visionId = VisionId(asUuid(payload.visionId, "a vision id")),
                provenance = asking.startingAStory,
            )
        }
        // A sample by its name. A name that is not a sample is refused as malformed, and a house with no key
        // figure to speak it as `noSuchKeyFigure`. See decision record 0071.
        lever<OfferDialoguePayload>(commands) { asking, payload ->
            dialogues.offerSample(player = asking.who, sample = payload.sample, provenance = asking.startingAStory)
        }
        // The world's luck, for the next roll this player makes: a rarity, or none for the throw again. See 0083.
        lever<NextRarityPayload>(commands) { asking, payload -> rolls.forceNext(asking.who, payload.rarity?.let(::asRarity)) }
    }

    private fun keyFigureLevers(commands: Commands) {
        lever<AddKeyFigurePayload>(commands) { asking, _ -> keyFigures.add(asking.who, asking.startingAStory) }
        lever<ChangeStatPayload>(commands) { asking, payload ->
            keyFigures.changeStat(
                player = asking.who,
                characterId = figure(payload.characterId),
                stat = asStat(payload.stat),
                by = payload.by,
                provenance = asking.startingAStory,
            )
        }
        lever<AgeCharacterPayload>(commands) { asking, payload ->
            keyFigures.age(
                player = asking.who,
                characterId = figure(payload.characterId),
                years = payload.years,
                provenance = asking.startingAStory,
            )
        }
        lever<ChangePortraitPayload>(commands) { asking, payload ->
            keyFigures.changePortrait(
                player = asking.who,
                characterId = figure(payload.characterId),
                portrait = payload.portrait,
                provenance = asking.startingAStory,
            )
        }
        lever<KillCharacterPayload>(commands) { asking, payload ->
            keyFigures.kill(
                player = asking.who,
                characterId = figure(payload.characterId),
                cause = payload.cause,
                provenance = asking.startingAStory,
            )
        }
        // A place off the world is refused by the place itself, as `invalidLocation`.
        lever<MoveCharacterPayload>(commands) { asking, payload ->
            keyFigures.move(
                player = asking.who,
                characterId = figure(payload.characterId),
                place = Location(payload.place.lat, payload.place.lon),
                provenance = asking.startingAStory,
            )
        }
        lever<TakeOffTheMapPayload>(commands) { asking, payload ->
            keyFigures.takeOffTheMap(
                player = asking.who,
                characterId = figure(payload.characterId),
                provenance = asking.startingAStory,
            )
        }
    }

    private fun figure(id: String) = CharacterId(asUuid(id, "a character id"))

    private inline fun <reified P : CommandPayload> lever(commands: Commands, noinline pull: (Asking, P) -> Unit) {
        commands.on<P> { asking, payload ->
            if (!open) {
                throw InstrumentsClosed()
            }
            pull(asking, payload)
        }
    }

    /**
     * Starts sending a connection every event, beginning with what it missed, or stops.
     *
     * Watching first and replaying after, so that nothing appended in between is lost. The cost is that
     * something can arrive twice, which is the feed's own bargain and the reader's to absorb.
     */
    private fun watchEvents(connection: Gateway.Connection, on: Boolean) = looking(connection, "watchEvents") {
        if (on) {
            watching += connection
            for (stored in recent.latest(MOST_RECENT_EVENTS)) {
                connection.out.send(stored.toFrame())
            }
        } else {
            watching -= connection
        }
    }

    /** The eye: significance set aside for this connection, or taken up again. See decision record 0038. */
    private fun seeAll(connection: Gateway.Connection, on: Boolean) = looking(connection, "seeAll") {
        if (connection.looking.everything != on) {
            connection.lookedAgain(connection.look { it.copy(everything = on) })
        }
    }

    /** The fog of war lifted for this connection, or let fall again. See decision record 0061. */
    private fun fogOfWar(connection: Gateway.Connection, on: Boolean) = looking(connection, "fogOfWar") {
        if (connection.looking.fogged != on) {
            connection.lookedAgain(connection.look { it.copy(fogged = on) })
        }
    }

    /**
     * Empties the world and finishes every session with it. Everybody is told, because a wipe is everybody's: a
     * window left holding a house that no longer exists would be showing a world that is not there. Each one
     * reloads and arrives anew. See decision record 0036.
     */
    private fun wipe(connection: Gateway.Connection) = looking(connection, "wipeWorld") {
        val gone = emptyTheWorld.wipe()
        core.endEverySession(WorldWiped("the world was emptied; $gone event${if (gone == 1) "" else "s"} went"))
    }

    /** A connection that is going hears nothing more. */
    override fun ended(connection: Gateway.Connection) {
        watching -= connection
    }

    private fun looking(connection: Gateway.Connection, frame: String, look: () -> Unit) {
        if (open) {
            look()
        } else {
            connection.out.send(ErrorFrame("instrumentsClosed", "$frame is one of the instruments, and they are closed here"))
        }
    }

    private fun tellWatchers(stored: StoredEvent) {
        val frame = stored.toFrame()
        for (connection in watching) {
            connection.out.send(frame)
        }
    }

    override fun close() {
        feed.close()
        drawn.close()
    }
}

/** What the debug panel says of a world this code cannot read all of, and what to do about it, pre-alpha. */
internal fun told(unreadable: Unreadable): String = buildString {
    if (unreadable.events > 0) {
        append("${unreadable.events} of this world's ${unreadable.of} events cannot be read by this code, the first ")
        append("${unreadable.first}, and a house with one in its history refuses every command. ")
    }
    if (unreadable.brokenAt != null) {
        append("The store could not be read back ${unreadable.brokenAt}, so the feed may have stopped. ")
    }
    append("Wipe this world: the World section, wipe")
    append(if (unreadable.brokenAt != null) ", then start the game server again." else ".")
}
