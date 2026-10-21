package villages.gateway

import villages.application.ChallengeMatchups
import villages.application.ChallengeSimulator
import villages.domain.Stat
import villages.domain.challenge.Aspect
import villages.domain.challenge.ChallengeCatalogue
import villages.domain.challenge.ChallengeEffect
import villages.domain.challenge.ChallengeKind
import villages.domain.challenge.ChallengeSlot
import villages.domain.challenge.Fires
import villages.domain.challenge.Fits
import villages.domain.challenge.SummonSpec

/** The rig's challenge content: Sellswords and its Mercenary, Trusted Envoy, and a skirmish. Its own, so a retune moves no test. */
internal val RIG_CHALLENGES = ChallengeCatalogue(
    effects = listOf(
        ChallengeEffect("violence.sellswords", Aspect.VIOLENCE, Fires.TRIGGER, summons = "mercenary"),
        ChallengeEffect("diplomacy.envoy", Aspect.DIPLOMACY, Fires.TRIGGER, slot = ChallengeSlot(Fits.KEY_FIGURE, Stat.KINDNESS)),
    ),
    summons = mapOf("mercenary" to SummonSpec(Aspect.VIOLENCE, mapOf("pulls" to 10.0))),
    kinds = mapOf("skirmish" to ChallengeKind(5..5, 1..1, 0.0, mapOf(Aspect.REASON to 1.0))),
)

/** The rig's challenge in the gateway: the engine on the rig's content, a seed of seven when none is given. */
internal fun challengesInTheRig(): ChallengesMechanic =
    ChallengesMechanic(
        ChallengeSimulator({ RIG_CHALLENGES }, { RIG_BALANCE.challenge }) { 7L },
        ChallengeMatchups({ RIG_CHALLENGES }, { RIG_BALANCE.challenge }) { 7L },
    ) { "rig-fingerprint" }
