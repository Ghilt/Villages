import { describeDay } from '@villages/protocol';

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
  /** The window in CSS pixels, which is what the sheet is measured against; `canvas` is device pixels. */
  viewport: { width: number; height: number };
  /**
   * The sheet: the world's square as one object, its side in CSS pixels, whether it covers the window,
   * and the two zooms that bound the desk: the floor it shrinks to, and the fit it covers the window from.
   * `atFloor` is the fraction of the window's shorter side it is at the floor. See decision record 0033.
   */
  sheet: { size: number; covers: boolean; floor: number; fit: number; atFloor: number };
  painted: { ready: number; waited: number; aheadPainted: number; held: number };
  worstFrameGap: number;
  /** The cells covering the view, at the camera's own zoom. What the map will subscribe to. */
  cells: string[];
  /** What the gateway has handed over for those cells: houses drawn, cells held, and houses left out. */
  houses: { drawn: number; held: number; omitted: number };
  /** The areas drawn on the map, and what the selected one holds. `kinds` is null until it is counted. */
  areas: {
    drawn: number;
    armed: boolean;
    selected: { id: string; pixels: number; kinds: number | null } | null;
  };
  /** Where the world's clock stands and which day is being looked at, or null before welcome. */
  world: { today: number; earliest: number; viewingAt: number | null } | null;
  /** Who this window is playing as, whether it still is, and which house is theirs. */
  player: { id?: string; connection: string; house: string | null };
  /** What the player has been asked, or null when nothing. What the parchment is showing. */
  choice: { prompt: string; options: number; acting: boolean } | null;
  /** What is selected on the map, or null when nothing is. What the inspector is showing. */
  selected: { kind: string; name: string } | null;
}

export interface Line {
  label: string;
  value: string;
}

/** One master pixel at the equator, in metres. The master spans the world's circumference. */
const EARTH_CIRCUMFERENCE = 40075017;

/** How many cell names will fit on a line of the panel before it stops being readable. */
const CELLS_SHOWN = 3;

/**
 * Who is playing here, and whether this window still is.
 *
 * A player plays from one place: opening a second window takes the player over and leaves this one saying
 * so, rather than two windows quietly halving the world between them. See decision record 0028.
 */
function describePlayer(player: { id?: string; connection: string }): string {
  const who = player.id === undefined ? 'not introduced yet' : player.id.slice(0, 8);
  switch (player.connection) {
    case 'open':
      return `${who}, playing here`;
    case 'takenOver':
      return `${who}, taken over in another window`;
    case 'closed':
      return `${who}, the connection closed`;
    default:
      return `${who}, connecting`;
  }
}

/** What the player has to decide, and whether an answer to it is in flight. See decision record 0034. */
function describeChoice(choice: MapState['choice']): string {
  if (choice === null) {
    return 'nothing to decide';
  }
  const asked = `"${choice.prompt}", ${choice.options} option${choice.options === 1 ? '' : 's'}`;
  return choice.acting ? `${asked}, answering` : asked;
}

/** The world's day, and the day the map is showing, which differ when the scrubber has been moved. */
function describeWorld(world: { today: number; earliest: number; viewingAt: number | null } | null): string {
  if (world === null) {
    return 'not heard from the gateway yet';
  }
  const looking = world.viewingAt === null ? 'showing live' : `showing ${describeDay(world.viewingAt)}`;
  return `${describeDay(world.today)} today, ${looking}`;
}

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
  // The one cell at zoom 0 is named by the empty string, which would leave the line looking cut off.
  const named = [...cells]
    .sort()
    .slice(0, CELLS_SHOWN)
    .map((cell) => (cell === '' ? 'the whole world' : cell))
    .join(' ');
  const rest = cells.length - CELLS_SHOWN;
  return `${cells.length} at z${zoom}: ${named}${rest > 0 ? ` and ${rest} more` : ''}`;
}

function describeAreas(areas: MapState['areas']): string {
  const drawn = areas.drawn === 0 ? 'none drawn' : `${areas.drawn} drawn`;
  return areas.armed ? `${drawn}, drawing` : drawn;
}

/** What the selected area holds, in the unit it is counted in: master pixels, the ones a hand paints. */
function describeArea(selected: MapState['areas']['selected']): string {
  if (selected === null) {
    return 'none selected';
  }
  const counted =
    selected.kinds === null ? 'not counted yet' : `${selected.kinds} kind${selected.kinds === 1 ? '' : 's'}`;
  return `${selected.id}: ${selected.pixels.toLocaleString()} master px, ${counted}`;
}

/**
 * Where the sheet lies: covering the window, or a size on the desk as a share of the window's shorter
 * side, since that is the side the floor is measured by. See decision record 0033.
 */
function describeSheet(sheet: MapState['sheet'], viewport: MapState['viewport']): string {
  if (sheet.covers) {
    return 'covers the view';
  }
  const shorter = Math.min(viewport.width, viewport.height);
  const along = viewport.height <= viewport.width ? 'height' : 'width';
  return `${Math.round(sheet.size)} px, ${Math.round((100 * sheet.size) / shorter)}% of the view's ${along}, on the desk`;
}

/** The two zooms that bound the desk, so a floor that moves with the window can be read rather than guessed. */
function describeFloor(sheet: MapState['sheet']): string {
  return (
    `z${sheet.floor.toFixed(2)} (the sheet at ${Math.round(100 * sheet.atFloor)}% of the shorter side), ` +
    `covers the view from z${sheet.fit.toFixed(2)}`
  );
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
    { label: 'sheet', value: describeSheet(state.sheet, state.viewport) },
    { label: 'floor', value: describeFloor(state.sheet) },
    {
      label: 'centre',
      value: `${state.centre.lng.toFixed(3)}, ${state.centre.lat.toFixed(3)}`,
    },
    { label: 'cells', value: describeCells(state.cells, state.tileZoom) },
    { label: 'houses', value: describeHouses(state.houses) },
    { label: 'areas', value: describeAreas(state.areas) },
    { label: 'area', value: describeArea(state.areas.selected) },
    { label: 'world', value: describeWorld(state.world) },
    { label: 'player', value: describePlayer(state.player) },
    { label: 'house', value: state.player.house ?? 'none yet' },
    { label: 'choice', value: describeChoice(state.choice) },
    {
      label: 'selected',
      value: state.selected === null ? 'nothing' : `${state.selected.kind}: ${state.selected.name}`,
    },
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
