/**
 * A binary heap of nodes by cost, growing as it needs to: the frontier of a shortest-path search, which hands back
 * the cheapest node first. `pop` on an empty heap is the caller's mistake.
 */
export class CostHeap {
  private costs = new Float64Array(1024);
  private nodes = new Int32Array(1024);
  size = 0;

  push(cost: number, node: number): void {
    if (this.size === this.costs.length) {
      const costs = new Float64Array(this.size * 2);
      costs.set(this.costs);
      this.costs = costs;
      const nodes = new Int32Array(this.size * 2);
      nodes.set(this.nodes);
      this.nodes = nodes;
    }
    let at = this.size++;
    while (at > 0) {
      const above = (at - 1) >> 1;
      if (this.costs[above]! <= cost) break;
      this.costs[at] = this.costs[above]!;
      this.nodes[at] = this.nodes[above]!;
      at = above;
    }
    this.costs[at] = cost;
    this.nodes[at] = node;
  }

  pop(): number {
    const top = this.nodes[0]!;
    const cost = this.costs[--this.size]!;
    const node = this.nodes[this.size]!;
    let at = 0;
    for (;;) {
      let child = at * 2 + 1;
      if (child >= this.size) break;
      if (child + 1 < this.size && this.costs[child + 1]! < this.costs[child]!) child += 1;
      if (this.costs[child]! >= cost) break;
      this.costs[at] = this.costs[child]!;
      this.nodes[at] = this.nodes[child]!;
      at = child;
    }
    this.costs[at] = cost;
    this.nodes[at] = node;
    return top;
  }
}
