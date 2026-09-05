/**
 * What the program will say about itself, as text.
 *
 * Pure, so that the awkward arithmetic in it can be tested rather than squinted at on a screen: how much
 * ground a pixel covers, which zoom the terrain is really coming from and how far it is being stretched.
 * Those are the numbers that explain what the map looks like, and they are not obvious from the zoom.
 */

export interface MapState {
  renderer: string;
  /** Where the camera is, which is a fraction. */
  zoom: number;
  /** Which zoom of tiles MapLibre is actually asking for, which is a whole number. */
  tileZoom: number;
  /** The deepest zoom the terrain was cut at. Past it, tiles are stretched from this one. */
  flatMaxZoom: number;
  masterWidth: number;
  tileSize: number;
  centre: { lng: number; lat: number };
  canvas: { width: number; height: number };
  pixelRatio: number;
  painted: { ready: number; waited: number; aheadPainted: number; held: number };
  worstFrameGap: number;
  /** The cells covering the view, at the camera's own zoom. What the map will subscribe to. */
  cells: string[];
  /** What the gateway has handed over for those cells: houses drawn, cells held, and houses left out. */
  houses: { drawn: number; held: number; omitted: number };
}

export interface Line {
  label: string;
  value: string;
}

/** One master pixel at the equator, in metres. The master spans the world's circumference. */
const EARTH_CIRCUMFERENCE = 40075017;

/** How many cell names will fit on a line of the panel before it stops being readable. */
const CELLS_SHOWN = 3;

/** What the map is drawing from the gateway, and what it was not sent. */
function describeHouses(houses: { drawn: number; held: number; omitted: number }): string {
  if (houses.held === 0) {
    return 'no cells held yet';
  }
  const drawn = `${houses.drawn} drawn from ${houses.held} cell${houses.held === 1 ? '' : 's'}`;
  return houses.omitted > 0 ? `${drawn}, ${houses.omitted} more not sent` : drawn;
}

/**
 * The cells the view covers, which is what the map will ask the gateway for.
 *
 * Shown because it is the one place the grid is visible: the count should stay roughly the same at
 * every zoom, and each name should be exactly as many digits as the zoom. A count that climbs as you
 * zoom out means the client is asking for the world a tile at a time. See decision record 0026.
 */
function describeCells(cells: string[], zoom: number): string {
  if (cells.length === 0) {
    return 'none';
  }
  const named = [...cells].sort().slice(0, CELLS_SHOWN).join(' ');
  const rest = cells.length - CELLS_SHOWN;
  return `${cells.length} at z${zoom}: ${named}${rest > 0 ? ` and ${rest} more` : ''}`;
}

export function describeState(state: MapState): Line[] {
  const masterPerPixel = state.masterWidth / (state.tileSize * 2 ** state.tileZoom);
  const stretch = 2 ** Math.max(0, state.tileZoom - state.flatMaxZoom);
  const metres =
    (masterPerPixel * EARTH_CIRCUMFERENCE * Math.cos((state.centre.lat * Math.PI) / 180)) / state.masterWidth;
  const asked = state.painted.ready + state.painted.waited;

  return [
    { label: 'renderer', value: state.renderer },
    { label: 'zoom', value: `${state.zoom.toFixed(2)}, asking for z${state.tileZoom} tiles` },
    {
      label: 'terrain',
      value:
        stretch === 1 ? `z${state.tileZoom}, as cut` : `z${state.flatMaxZoom} as cut, stretched ${stretch}x`,
    },
    {
      label: 'a pixel is',
      value: `${masterPerPixel.toFixed(2)} master px, about ${
        metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`
      }`,
    },
    {
      label: 'centre',
      value: `${state.centre.lng.toFixed(3)}, ${state.centre.lat.toFixed(3)}`,
    },
    { label: 'cells', value: describeCells(state.cells, state.tileZoom) },
    { label: 'houses', value: describeHouses(state.houses) },
    {
      label: 'painted',
      value:
        asked === 0
          ? `nothing asked for yet, ${state.painted.aheadPainted} ahead`
          : `${Math.round((100 * state.painted.ready) / asked)}% ready ` +
            `(${state.painted.ready}/${asked}), ${state.painted.aheadPainted} ahead, ` +
            `${state.painted.held} held`,
    },
    {
      label: 'frames',
      value: `worst gap ${Math.round(state.worstFrameGap)} ms`,
    },
    {
      label: 'canvas',
      value: `${state.canvas.width} by ${state.canvas.height}, ratio ${state.pixelRatio}`,
    },
  ];
}
