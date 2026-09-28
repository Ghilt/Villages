package villages.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe

/** The quadkey of the cell `column` across and `row` down at `zoom`. */
private fun cellAt(column: Int, row: Int, zoom: Int): String = buildString {
    for (level in zoom downTo 1) {
        val bit = 1 shl (level - 1)
        append('0' + (if (column and bit != 0) 1 else 0) + (if (row and bit != 0) 2 else 0))
    }
}

private fun tile(x: Int, y: Int) = y * STAND_TILES + x

class StandTilesSpec : StringSpec({

    "a held cell well inside a tile wants that tile alone" {
        // Stockholm at zoom 10: a 32-unit cell a hundred units into tile 70 across and 37 down.
        standTilesUnder("1200312213") shouldBe listOf(tile(70, 37))
    }

    "a held cell in the corner of a tile wants the four tiles its margin reaches into" {
        // Eight zoom 10 cells to a tile, so column 560 and row 296 are tile 70 and 37's north-west corner.
        standTilesUnder(cellAt(560, 296, 10)) shouldContainExactlyInAnyOrder
            listOf(tile(69, 36), tile(70, 36), tile(69, 37), tile(70, 37))
    }

    "a zoom 7 cell is a tile, and wants the ring about it too" {
        standTilesUnder(cellAt(70, 37, 7)) shouldContainExactlyInAnyOrder
            (36..38).flatMap { y -> (69..71).map { x -> tile(x, y) } }
    }

    "across wraps round the world, and down stops at its edges" {
        standTilesUnder(cellAt(0, 0, 7)) shouldContainExactlyInAnyOrder
            (0..1).flatMap { y -> listOf(127, 0, 1).map { x -> tile(x, y) } }
        standTilesUnder(cellAt(127, 127, 7)) shouldContainExactlyInAnyOrder
            (126..127).flatMap { y -> listOf(126, 127, 0).map { x -> tile(x, y) } }
    }

    "a zoom 6 cell wants its four tiles and the ring about them, and anything coarser wants none" {
        standTilesUnder(cellAt(35, 18, 6)) shouldContainExactlyInAnyOrder
            (35..38).flatMap { y -> (69..72).map { x -> tile(x, y) } }
        standTilesUnder(cellAt(17, 9, 5)).shouldBeEmpty()
        standTilesUnder("").shouldBeEmpty()
    }
})
