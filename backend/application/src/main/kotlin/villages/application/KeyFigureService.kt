package villages.application

import villages.domain.ActThrough
import villages.domain.AgeCharacter
import villages.domain.ChangePortrait
import villages.domain.ChangeStat
import villages.domain.CharacterError
import villages.domain.CharacterId
import villages.domain.CheckRoomForKeyFigure
import villages.domain.HouseError
import villages.domain.HouseId
import villages.domain.KillCharacter
import villages.domain.Location
import villages.domain.LoseKeyFigure
import villages.domain.MoveCharacter
import villages.domain.PlayerId
import villages.domain.Significance
import villages.domain.Stat
import villages.domain.TakeKeyFigure
import villages.domain.TakeOffTheMap

/**
 * A house's key figures: taking one in, and every lever on one of them.
 *
 * Two kinds of stream meet here, and the order they are written in is the whole of the design. Taking a key
 * figure in asks the house for room first, then brings the newcomer into the world, then has the house take
 * them in, all in the command's own story, so that the chronicle reads *appeared, gained key figure* in the
 * order it happened. The two writes are not one decision, and a race between the room check and the tie can
 * leave a character nobody holds: placeless, reachable by no lever, and harmless. See decision record 0055.
 *
 * Every other lever names a character, so it asks the player's own house first, with `ActThrough`, and is
 * refused `NoSuchKeyFigure` unless the character is one of that house's. Only then does it touch the
 * character's stream: a player's levers reach their own key figures and nobody else's.
 */
class KeyFigureService(
    private val houses: HouseCommandExecutor,
    private val characters: CharacterCommandExecutor,
    private val clock: Clock,
    private val world: WorldClock,
    private val calendar: WorldCalendar,
    private val dice: Dice,
    private val portraits: Portraits,
    /** How old a newcomer can be is the balance's. See decision record 0097. */
    private val balance: () -> Balance,
) {
    /**
     * Bring a newcomer in as one of the player's house's key figures, and say who they are.
     *
     * The id is worked out from the house and the command, so the same command sent again lands on the same
     * stream: the appearance is refused as already made, the tie as already there, and the second sending
     * finishes whatever the first left undone rather than making a twin.
     */
    fun add(player: PlayerId, provenance: Provenance): CharacterId {
        val house = HouseId.of(player)
        val id = CharacterId.broughtIn(house, provenance.commandId)
        val today = world.today()
        val now = clock.now()

        houses.execute(CheckRoomForKeyFigure(house), provenance)
        try {
            characters.execute(Newcomers.roll(id, today, now, calendar, dice, portraits, balance().newcomers.ages), provenance)
        } catch (@Suppress("SwallowedException") again: CharacterError.AlreadyAppeared) {
            // Sent before: they are in the world already, and the tie below is what is left to do.
            Unit
        }
        try {
            houses.execute(TakeKeyFigure(house, id, today, now), provenance)
        } catch (@Suppress("SwallowedException") again: HouseError.AlreadyAKeyFigure) {
            // Sent before, and finished before: nothing is left to do.
            Unit
        }
        return id
    }

    fun changeStat(player: PlayerId, characterId: CharacterId, stat: Stat, by: Int, provenance: Provenance) {
        actThrough(player, characterId, provenance)
        characters.execute(ChangeStat(characterId, stat, by, world.today(), clock.now()), provenance)
    }

    fun age(player: PlayerId, characterId: CharacterId, years: Int, provenance: Provenance) {
        actThrough(player, characterId, provenance)
        characters.execute(AgeCharacter(characterId, years, world.today(), clock.now()), provenance)
    }

    fun changePortrait(player: PlayerId, characterId: CharacterId, portrait: String?, provenance: Provenance) {
        actThrough(player, characterId, provenance)
        characters.execute(ChangePortrait(characterId, portrait, world.today(), clock.now()), provenance)
    }

    /**
     * Put a key figure somewhere on the map, at the significance a key figure has there. The place is the
     * player's to say; how much it matters is the world's, so it is set here and never sent.
     */
    fun move(player: PlayerId, characterId: CharacterId, place: Location, provenance: Provenance) {
        actThrough(player, characterId, provenance)
        characters.execute(MoveCharacter(characterId, place, ON_THE_MAP, world.today(), clock.now()), provenance)
    }

    fun takeOffTheMap(player: PlayerId, characterId: CharacterId, provenance: Provenance) {
        actThrough(player, characterId, provenance)
        characters.execute(TakeOffTheMap(characterId, world.today(), clock.now()), provenance)
    }

    fun kill(player: PlayerId, characterId: CharacterId, cause: String, provenance: Provenance) {
        actThrough(player, characterId, provenance)
        characters.execute(KillCharacter(characterId, cause, world.today(), clock.now()), provenance)
    }

    /**
     * A house loses one of its key figures, whoever's house it is. Not a lever: the listener for character
     * deaths calls it when a character dies, and the house's own rule refuses a loss of somebody it does not
     * hold.
     */
    fun loseHeldBy(house: HouseId, characterId: CharacterId, provenance: Provenance) {
        houses.execute(LoseKeyFigure(house, characterId, world.today(), clock.now()), provenance)
    }

    /** The player's house says whether the character is one of its own; the answer is a refusal or nothing. */
    private fun actThrough(player: PlayerId, characterId: CharacterId, provenance: Provenance) {
        houses.execute(ActThrough(HouseId.of(player), characterId), provenance)
    }

    companion object {
        /**
         * How much a key figure on the map matters to the world: ten, which is drawn from zoom 9, a little
         * closer in than a house. The same for every one of them until something decides it per person -
         * Adam's words were that it will depend greatly on the character. See decision record 0026.
         */
        val ON_THE_MAP: Significance = Significance(10.0)
    }
}
