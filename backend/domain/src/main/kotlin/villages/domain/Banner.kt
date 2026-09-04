package villages.domain

/**
 * A heraldic colour. Metals are or and argent; colours are gules, azure, sable, vert and purpure. The rule
 * of tincture says a charge of a metal goes on a field of a colour, and the reverse, and `Banner` enforces
 * it: it is the first rule of a house's identity.
 */
enum class Tincture(val isMetal: Boolean) {
    OR(isMetal = true),
    ARGENT(isMetal = true),
    GULES(isMetal = false),
    AZURE(isMetal = false),
    SABLE(isMetal = false),
    VERT(isMetal = false),
    PURPURE(isMetal = false),
    ;

    /** Whether a charge of this tincture may lie on a field of the other. */
    fun contrastsWith(other: Tincture): Boolean = isMetal != other.isMetal
}

/** How the field of a banner is partitioned. Anything but plain needs a second tincture. */
enum class Division {
    PLAIN,
    PER_PALE,
    PER_FESS,
    QUARTERLY,
    ;

    val isDivided: Boolean get() = this != PLAIN
}

/** The figure borne on a banner. Three to begin with. */
enum class Charge {
    TOWER,
    STAG,
    STAR,
}

/**
 * A house's heraldic device: a field of one or two tinctures, a division, and a charge. Shown in the
 * interface and as the house's sprite on the map.
 *
 * Two rules hold, and a banner that breaks either does not exist: the charge contrasts with the field, and
 * a divided field has a second tincture that differs from the first, while a plain field has none.
 */
data class Banner(
    val field: Tincture,
    val division: Division,
    val second: Tincture?,
    val charge: Charge,
    val chargeTincture: Tincture,
) {
    init {
        if (!chargeTincture.contrastsWith(field)) {
            throw HouseError.InvalidBanner(
                "a ${chargeTincture.name.lowercase()} charge on a ${field.name.lowercase()} field: metal on metal or colour on colour",
            )
        }
        if (division.isDivided && second == null) {
            throw HouseError.InvalidBanner("a field ${division.name.lowercase().replace('_', ' ')} needs a second tincture")
        }
        if (!division.isDivided && second != null) {
            throw HouseError.InvalidBanner("a plain field has one tincture, not two")
        }
        if (second == field) {
            throw HouseError.InvalidBanner("a divided field needs two different tinctures")
        }
    }
}
