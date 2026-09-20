/**
 * The seam between the two bays, drawn.
 *
 * Three gold rules running the whole length of the stage - a heavy one on the join and a lighter one
 * either side of it - with a fixed **knot** of ornament where the eye lands. Nested contours, studs, a
 * lozenge and open curls: the achievement's vocabulary at the size of a rule, so the frame the shield
 * hangs in and the join between the bays are visibly one hand. See `LOOK-AND-FEEL.md`.
 *
 * **It lies over the seam rather than taking room from the bays.** Nothing in `bayBox.ts` knows it exists
 * and no arithmetic changed to make room for it: the two bays still add up to the long side exactly, and
 * this is a band straddling the line where they meet. Adam chose that over cutting room out of them.
 *
 * **The rules stretch and the knot does not**, which is the whole of why it is drawn in two media. The
 * rules are this element's own background gradient, in exact pixels, so they are crisp at any length and
 * there is nothing to lay out. The knot is an SVG rendered at its own viewBox size - one user unit to one
 * pixel - so the ornament cannot stretch with the band, and its lines land on exactly the pixels the
 * gradient draws. A stretched ornament is an ornament that has been noticed. **Anything that gives the
 * knot a percentage width breaks the moulding in the middle**, silently.
 *
 * One drawing turned: a band across a portrait stage, the same band down a landscape one with the knot
 * given a quarter turn. That is what the whole stage does when the phone turns, so the seam does it too.
 *
 * It takes no pointer. A moulding that eats a drag meant for the map is a moulding that has to be
 * explained.
 */

/** How long and how thick the knot is, in pixels, which is also its viewBox. */
const KNOT = { long: 72, across: 20 } as const;

const SEAM = {
  /**
   * One curl, springing from the rule and turning back on itself without closing.
   *
   * Drawn once and mirrored four ways rather than drawn four times, which is the needle's rule: a mark
   * that is redrawn is a mark that drifts.
   */
  curl: 'M50 10 C54.5 10 57.5 9 59 6.6 C59.9 5.1 58.6 3.7 57.3 4.5 C56.4 5.1 56.7 6.3 57.7 6.4',
  /** The lozenge the two runs of rule meet at: the achievement's crest, at the size of a seam. */
  crest: 'M36 4.6 L40 10 L36 15.4 L32 10 Z',
} as const;

/** The four the one curl is drawn as: mirrored about the rule, and about the middle of the knot. */
const MIRRORED = [
  'none',
  'scale(1 -1) translate(0 -20)',
  'scale(-1 1) translate(-72 0)',
  'scale(-1 -1) translate(-72 -20)',
] as const;

export function Seam({ along }: { along: 'rows' | 'columns' }) {
  return (
    <div className={`seam seam--${along}`} aria-hidden="true">
      <svg
        className="seam__knot"
        viewBox={`0 0 ${KNOT.long} ${KNOT.across}`}
        width={KNOT.long}
        height={KNOT.across}
        role="presentation"
      >
        {MIRRORED.map((turn) => (
          <path
            key={turn}
            d={SEAM.curl}
            className="ornament"
            transform={turn === 'none' ? undefined : turn}
          />
        ))}
        <circle cx="27" cy="10" r="1.7" className="ornament__stud" />
        <circle cx="45" cy="10" r="1.7" className="ornament__stud" />
        <path d={SEAM.crest} className="ornament__stud" />
      </svg>
    </div>
  );
}
