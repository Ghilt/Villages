/**
 * Cells that cannot be cut until a tile's stands come, by tile, each with who to tell when it does.
 *
 * **Every cell waiting on a tile is told, not the first.** A zoom 7 tile holds sixty-four cells and several are
 * asked for in one frame, and a cell told nothing stays *not yet* for ever: a patch of bare ground that never
 * sprouts, which is what the fetching this replaced did until 2026-09-25. A cell asked for again still waits
 * once, so a tile that is slow to come does not gather a caller a frame.
 */
export class Waiting {
  private readonly byTile = new Map<number, Map<string, () => void>>();

  /** The cell `key` waits on `tile`, and `ready` is what to tell it. */
  on(tile: number, key: string, ready: () => void): void {
    let cells = this.byTile.get(tile);
    if (cells === undefined) {
      cells = new Map();
      this.byTile.set(tile, cells);
    }
    cells.set(key, ready);
  }

  /** The tile has come: every cell waiting on it is told, once, and waits on it no longer. */
  came(tile: number): void {
    const cells = this.byTile.get(tile);
    if (cells === undefined) {
      return;
    }
    this.byTile.delete(tile);
    for (const ready of cells.values()) {
      ready();
    }
  }

  /**
   * Stops waiting on every tile that is not coming. Only a later move of the camera can bring one, and the frames
   * of that move ask for the cells again.
   */
  keepOnly(coming: (tile: number) => boolean): void {
    for (const tile of [...this.byTile.keys()]) {
      if (!coming(tile)) {
        this.byTile.delete(tile);
      }
    }
  }

  /** How many cells are waiting on anything. */
  get cells(): number {
    const keys = new Set<string>();
    for (const cells of this.byTile.values()) {
      for (const key of cells.keys()) {
        keys.add(key);
      }
    }
    return keys.size;
  }

  clear(): void {
    this.byTile.clear();
  }
}
