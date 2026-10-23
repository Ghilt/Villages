package villages.application

import villages.domain.AcceptChallenge
import villages.domain.ChallengeId
import villages.domain.ChallengeNode
import villages.domain.FoughtChallenge
import villages.domain.HouseId
import villages.domain.NodeId
import villages.domain.PlayerId
import villages.domain.QuestId
import villages.domain.challenge.Challenge
import villages.domain.challenge.ChallengeSetup
import villages.domain.challenge.Progressions

/**
 * Accepting the challenge a quest's node puts to the house, with the starting slices the player brings: the challenge
 * fought out here, on the node's terms as the read model has them and with the catalogue and the rules in force, from a
 * seed drawn here, because the luck is the application's as the fate engine's dice are (0083); and handed to the house,
 * which checks it was fought on the node's terms with slices of its own and takes it in one decision with the quest's
 * move on. A node that puts no challenge, or slices the house does not hold, are fought not at all, and the house says
 * why. See decision record 0107, amended.
 */
class ChallengeService(
    private val executor: HouseCommandExecutor,
    private val clock: Clock,
    private val world: WorldClock,
    private val quests: QuestsByHouse,
    /** The challenge catalogue and the balance in force: the content, the starting slices and the rules. See 0097. */
    private val catalogues: () -> Catalogues,
    private val seeds: Seeds,
    /** The fingerprint of the challenge catalogue in force, recorded with the challenge so a replay can say it differs. */
    private val fingerprint: () -> String,
) {
    /**
     * Accepts the challenge at [node] of [quest], bringing the starting slices [brought] by their ids, and says which
     * challenge it turned out to be: an identity worked out from the command, so the same command sent twice names one.
     */
    fun accept(player: PlayerId, quest: QuestId, node: NodeId, brought: List<String>, provenance: Provenance): ChallengeId {
        val house = HouseId.of(player)
        val inForce = catalogues()
        val content = inForce.challenges
        val id = ChallengeId.accepted(house, provenance.commandId)
        val terms = (quests.of(house).firstOrNull { it.quest.id == quest }?.quest?.node(node) as? ChallengeNode)?.challenge
        val ours = brought.mapNotNull(content.starting::get)
        val fought = if (terms == null || ours.size != brought.size || brought.distinct().size != brought.size) {
            null
        } else {
            content.kinds[terms.kind]?.let { kind ->
                val seed = seeds.draw()
                val setup = ChallengeSetup(ours, terms.slices, Progressions.draw(kind, seed))
                setup.takeIf { it.refusals(content).isEmpty() }?.let {
                    FoughtChallenge(terms.kind, it, Challenge.resolve(it, seed, content, inForce.balance.challenge), fingerprint(), Challenge.ENGINE)
                }
            }
        }
        executor.execute(AcceptChallenge(house, quest, node, brought, content.starting, id, fought, world.today(), clock.now()), provenance)
        return id
    }
}
