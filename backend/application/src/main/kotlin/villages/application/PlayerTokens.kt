package villages.application

import villages.domain.PlayerId

/** Who a token belongs to. Anonymous browser tokens for now; accounts replace this without moving anything. */
fun interface PlayerTokens {
    fun playerOf(token: String): PlayerId
}
