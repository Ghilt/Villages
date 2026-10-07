/**
 * The origin map as a file, and the question a page asks of it: where on Earth did this point come from?
 *
 * `origin.bin` is seven columns of 32-bit floats, a value a square for every square in turn - where its
 * middle came from across and down, the four numbers of its matrix, and its agreement - then a byte a square
 * for its status. `origin.json` beside it says how many squares and how big. Kept apart from `origin.ts`, which
 * works the map out, so that a page can read one without the other. See `docs/plans/real-world-names.md`.
 */

/** The statuses, as `origin.ts` writes them. */
export const ORIGIN_SEA = 0;
export const ORIGIN_EARTH = 1;
export const ORIGIN_INVENTED = 2;
export const ORIGIN_CLONE = 3;

export interface OriginGrid {
  readonly cell: number;
  readonly columns: number;
  readonly rows: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly a: Float32Array;
  readonly b: Float32Array;
  readonly c: Float32Array;
  readonly d: Float32Array;
  readonly agreement: Float32Array;
  readonly status: Uint8Array;
}

/** What `origin.json` says. */
export interface OriginFile {
  readonly master: string;
  readonly from: string;
  readonly cell: number;
  readonly columns: number;
  readonly rows: number;
  readonly width: number;
  readonly height: number;
  readonly counts: {
    readonly sea: number;
    readonly earth: number;
    readonly invented: number;
    readonly clone: number;
  };
}

const COLUMNS = ['x', 'y', 'a', 'b', 'c', 'd', 'agreement'] as const;

export function encodeOrigin(grid: OriginGrid): Uint8Array {
  const n = grid.columns * grid.rows;
  const out = new Uint8Array(n * 4 * COLUMNS.length + n);
  COLUMNS.forEach((name, at) =>
    out.set(new Uint8Array(grid[name].buffer, grid[name].byteOffset, n * 4), at * n * 4),
  );
  out.set(grid.status, n * 4 * COLUMNS.length);
  return out;
}

export function decodeOrigin(
  bytes: ArrayBuffer,
  file: Pick<OriginFile, 'cell' | 'columns' | 'rows'>,
): OriginGrid {
  const n = file.columns * file.rows;
  if (bytes.byteLength !== n * (4 * COLUMNS.length + 1)) {
    throw new Error(`an origin map of ${n} squares is ${n * 29} bytes, not ${bytes.byteLength}`);
  }
  const column = (at: number) => new Float32Array(bytes.slice(at * n * 4, (at + 1) * n * 4));
  return {
    cell: file.cell,
    columns: file.columns,
    rows: file.rows,
    x: column(0),
    y: column(1),
    a: column(2),
    b: column(3),
    c: column(4),
    d: column(5),
    agreement: column(6),
    status: new Uint8Array(bytes.slice(n * 4 * COLUMNS.length)),
  };
}

/** Where a point of the world came from: Earth's longitude and latitude, or why there is none. */
export type WhereFrom =
  | {
      readonly kind: 'earth' | 'clone';
      readonly lng: number;
      readonly lat: number;
      readonly agreement: number;
    }
  | { readonly kind: 'invented'; readonly agreement: number }
  | { readonly kind: 'sea' };

/**
 * Where the point at a world longitude and latitude was cut from. The master is equirectangular and so is
 * plain Earth's, both `width` by `height`, so a longitude is a column and a latitude a row in each.
 */
export function whereFrom(
  grid: OriginGrid,
  lng: number,
  lat: number,
  width: number,
  height: number,
): WhereFrom {
  const mx = Math.min(width - 1, Math.max(0, ((lng + 180) / 360) * width));
  const my = Math.min(height - 1, Math.max(0, ((90 - lat) / 180) * height));
  const k = squareAt(grid, lng, lat, width, height);
  const status = grid.status[k];
  if (status === undefined || status === ORIGIN_SEA) return { kind: 'sea' };
  if (status === ORIGIN_INVENTED) return { kind: 'invented', agreement: grid.agreement[k]! };
  const dx = mx - ((k % grid.columns) * grid.cell + grid.cell / 2);
  const dy = my - (Math.floor(k / grid.columns) * grid.cell + grid.cell / 2);
  const u = grid.x[k]! + grid.a[k]! * dx + grid.b[k]! * dy;
  const v = grid.y[k]! + grid.c[k]! * dx + grid.d[k]! * dy;
  return {
    kind: status === ORIGIN_CLONE ? 'clone' : 'earth',
    lng: (((((u / width) * 360) % 360) + 360) % 360) - 180,
    lat: 90 - (v / height) * 180,
    agreement: grid.agreement[k]!,
  };
}

/** Which square of the origin map a world longitude and latitude falls in, for a master `width` by `height`. */
export function squareAt(grid: OriginGrid, lng: number, lat: number, width: number, height: number): number {
  const mx = Math.min(width - 1, Math.max(0, ((lng + 180) / 360) * width));
  const my = Math.min(height - 1, Math.max(0, ((90 - lat) / 180) * height));
  return Math.floor(my / grid.cell) * grid.columns + Math.floor(mx / grid.cell);
}
