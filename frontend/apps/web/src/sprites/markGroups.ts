/*
 * Which marks far out stand for others: a crowd of marks whose pictures would overlap on the screen is drawn as one,
 * the most significant of them, wearing how many more it stands for. Pure, so the rule can be tested without a
 * renderer, and so the same marks under the same camera are always the same groups. See decision record 0096.
 */

/** A mark showing as its icon, where it stands on the screen and how big it is drawn there. */
export interface Placed {
  id: string;
  /** Where it stands: its foot, the bottom middle of its picture. */
  x: number;
  y: number;
  width: number;
  height: number;
  significance: number;
}

/** The marks that lead, each with the ones it stands for, most significant first and itself first among them. */
export interface Groups {
  /** Every leader's group, the leader first, in rank order. A mark alone is a group of one. */
  led: Map<string, string[]>;
  /** The leader of every mark that is not one. */
  leaderOf: Map<string, string>;
}

/** Most significant first, and among equals by id, so a tie is always broken the same way. */
export function byRank(
  a: { id: string; significance: number },
  b: { id: string; significance: number },
): number {
  return b.significance - a.significance || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function overlaps(a: Placed, b: Placed): boolean {
  return Math.abs(a.x - b.x) * 2 < a.width + b.width && a.y - a.height < b.y && b.y - b.height < a.y;
}

/**
 * Groups the marks showing. Walked in rank order: a mark that overlaps a leader already found joins the first such,
 * and one that overlaps none leads its own. Only leaders are measured against, so a group never creeps along a chain
 * of marks each touching the next, and the leader is always the most significant of its group.
 */
export function groupMarks(placed: readonly Placed[]): Groups {
  const led = new Map<string, string[]>();
  const leaderOf = new Map<string, string>();
  const leaders: Placed[] = [];
  for (const mark of [...placed].sort(byRank)) {
    const leader = leaders.find((one) => overlaps(one, mark));
    if (leader === undefined) {
      leaders.push(mark);
      led.set(mark.id, [mark.id]);
    } else {
      led.get(leader.id)!.push(mark.id);
      leaderOf.set(mark.id, leader.id);
    }
  }
  return { led, leaderOf };
}
