package villages.gateway

import villages.domain.DomainError
import kotlin.reflect.KClass

/**
 * A domain refusal as the short code the protocol carries, which the interface turns into words: the error's own name,
 * `HouseError.NotEnoughFree` as `notEnoughFree`. A house's and a character's refusal of the same rule share a name,
 * `InvalidName`, and so a code, because the interface says them the same way. A new refusal needs nothing here.
 *
 * Every code the wire has carried is kept in `contracts/refusal-codes.txt`, and `RefusalCodesSpec` fails for one no
 * error gives any more, and for one given and not kept: a class renamed would otherwise change a word the page reads.
 * See `docs/plans/mechanic-modules.md`, step 3.
 */
internal fun DomainError.reasonCode(): String = codeOf(this::class)

/** The code of every refusal of a kind, worked out from its class. */
internal fun codeOf(error: KClass<out DomainError>): String = error.simpleName!!.replaceFirstChar { it.lowercase() }
