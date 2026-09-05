/**
 * What to ask the gateway for and what to let go of, when the view has moved.
 *
 * The camera says which cells it wants; the connection knows which it holds. The difference is two
 * frames at most, and a view that has not really moved is no frames at all.
 */
export interface Following {
  /** Cells wanted and not yet held, in the order they were wanted. */
  ask: string[];
  /** Cells held and no longer wanted. */
  letGo: string[];
}

export function whatToFollow(held: Iterable<string>, wanted: Iterable<string>): Following {
  const holding = new Set(held);
  const wanting = new Set(wanted);
  return {
    ask: [...wanting].filter((cell) => !holding.has(cell)),
    letGo: [...holding].filter((cell) => !wanting.has(cell)),
  };
}
