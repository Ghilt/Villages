/**
 * Height, for the relief experiment (0016): a grid of heights in metres on longitude and latitude, the way
 * ETOPO 2022 comes, and the Terrarium encoding MapLibre reads a height tile in.
 *
 * Everything here is arithmetic; reading the files is `bin/heightWorld.ts`'s.
 */

/**
 * Where the height reaches, west, south, east and north in degrees, and the closest zoom it is cut to: the
 * four ETOPO tiles around the Alps. The page asks for no height tile outside it, and the tool refuses to cut
 * one if the tiles it read say otherwise.
 */
export const HEIGHT_BOUNDS = [0, 30, 30, 60] as const;
export const HEIGHT_MAX_ZOOM = 8;

/** Heights on a regular grid of longitude and latitude, the first row the northernmost, each cell an area. */
export interface HeightGrid {
  width: number;
  height: number;
  /** The western edge of the first column, in degrees. */
  west: number;
  /** The northern edge of the first row, in degrees. */
  north: number;
  /** How wide and tall a cell is, in degrees. */
  cell: number;
  heights: Float32Array;
}

/**
 * A height as Terrarium's three bytes: `(red * 256 + green + blue / 256) - 32768` metres. Rounded to the metre,
 * so blue is always nought, which costs a hillshade nothing and lets the tile compress.
 */
export function toTerrarium(metres: number, into: Uint8Array, at: number): void {
  const whole = Math.min(65535, Math.max(0, Math.round(metres) + 32768));
  into[at] = whole >> 8;
  into[at + 1] = whole & 255;
  into[at + 2] = 0;
}

export function fromTerrarium(red: number, green: number, blue: number): number {
  return red * 256 + green + blue / 256 - 32768;
}

/**
 * Undoes the TIFF floating-point predictor, number 3, for one row of four-byte samples, one to a pixel.
 *
 * The row was written as four planes, the most significant byte of every sample first, whatever the file's
 * own byte order, and then differenced byte by byte along the whole row. See Adobe's TIFF technical note 3.
 */
export function undoFloatPredictor(row: Uint8Array, samples: number, into: Float32Array, at: number): void {
  for (let i = 1; i < row.length; i += 1) {
    row[i] = (row[i]! + row[i - 1]!) & 255;
  }
  const word = new DataView(new ArrayBuffer(4));
  for (let j = 0; j < samples; j += 1) {
    word.setUint8(0, row[j]!);
    word.setUint8(1, row[samples + j]!);
    word.setUint8(2, row[2 * samples + j]!);
    word.setUint8(3, row[3 * samples + j]!);
    into[at + j] = word.getFloat32(0);
  }
}

/** The grid at half the resolution, each cell the mean of the four it covers. A level of a pyramid. */
export function halve(grid: HeightGrid): HeightGrid {
  const width = Math.max(1, Math.floor(grid.width / 2));
  const height = Math.max(1, Math.floor(grid.height / 2));
  const heights = new Float32Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const above = 2 * row * grid.width;
    const below = above + grid.width;
    for (let column = 0; column < width; column += 1) {
      const at = 2 * column;
      heights[row * width + column] =
        (grid.heights[above + at]! +
          grid.heights[above + at + 1]! +
          grid.heights[below + at]! +
          grid.heights[below + at + 1]!) /
        4;
    }
  }
  return { width, height, west: grid.west, north: grid.north, cell: grid.cell * 2, heights };
}

/** The height at a place, read between the four nearest cell middles, and held at the edge past it. */
export function heightAt(grid: HeightGrid, lon: number, lat: number): number {
  const x = (lon - grid.west) / grid.cell - 0.5;
  const y = (grid.north - lat) / grid.cell - 0.5;
  const x0 = Math.min(grid.width - 1, Math.max(0, Math.floor(x)));
  const y0 = Math.min(grid.height - 1, Math.max(0, Math.floor(y)));
  const x1 = Math.min(grid.width - 1, x0 + 1);
  const y1 = Math.min(grid.height - 1, y0 + 1);
  const fx = Math.min(1, Math.max(0, x - x0));
  const fy = Math.min(1, Math.max(0, y - y0));
  const top = grid.heights[y0 * grid.width + x0]! * (1 - fx) + grid.heights[y0 * grid.width + x1]! * fx;
  const bottom = grid.heights[y1 * grid.width + x0]! * (1 - fx) + grid.heights[y1 * grid.width + x1]! * fx;
  return top * (1 - fy) + bottom * fy;
}

/**
 * How much of its height a place keeps near the edge of the grid: all of it a `band` of degrees in, none at
 * the edge, eased between. Past the grid the ground is flat, and a height that fell to nothing in one cell
 * would be shaded as a cliff along the whole edge; spread over a band it is a slope too gentle to see.
 */
export function edgeWeight(grid: HeightGrid, lon: number, lat: number, band: number): number {
  const east = grid.west + grid.width * grid.cell;
  const south = grid.north - grid.height * grid.cell;
  const inside = Math.min(lon - grid.west, east - lon, grid.north - lat, lat - south);
  if (inside <= 0) {
    return 0;
  }
  const t = Math.min(1, inside / band);
  return t * t * (3 - 2 * t);
}

/** The level of a pyramid, nought the finest, whose cell is nearest a pixel `degrees` wide without being wider. */
export function levelFor(degrees: number, finest: number, levels: number): number {
  const level = Math.floor(Math.log2(Math.max(1, degrees / finest)));
  return Math.min(levels - 1, Math.max(0, level));
}
