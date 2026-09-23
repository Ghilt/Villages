/**
 * A placeholder room, seen from the ceiling, drawn by the browser from an SVG rather than shipped as an
 * image. The same trick as the desk's grain, and the same standing: it is here to be looked at before it
 * is made, and swapping it for a painted room is a change to this file and nothing else.
 *
 * Its aspect is the desk's, because the room is a fixed multiple of the desk, so the viewBox and the
 * element it is drawn into always agree and nothing is squashed. Simple shapes on purpose - boards, a
 * rug, a chair, a chest, a hearth, a door and a window - so that what is being judged is the motion of
 * pulling back into it, not the furniture. See experiment 0009.
 */

/** The viewBox, whose ratio is `DESK_ASPECT` in desk/deskTop.ts. Change one and change the other. */
const WIDE = 1450;
const DEEP = 1000;

/** How far the stone runs in from the edge. The floor is what is left. */
const WALL = 112;

const FLOOR_W = WIDE - WALL * 2;
const FLOOR_D = DEEP - WALL * 2;

/** Boards run across the room, and the rug and the desk lie over them. */
const BOARD = 58;

function boards(): string {
  const lines: string[] = [];
  for (let y = WALL + BOARD; y < DEEP - WALL; y += BOARD) {
    lines.push(`M${WALL} ${y}H${WIDE - WALL}`);
  }
  // Each board ends somewhere, and the ends are staggered so the floor does not read as a grid.
  const ends = [320, 700, 1010, 505, 880, 245, 1120, 610, 400, 950, 760, 1060, 290, 840];
  ends.forEach((x, index) => {
    const top = WALL + BOARD * index;
    if (top + BOARD <= DEEP - WALL) {
      lines.push(`M${WALL + x} ${top}v${BOARD}`);
    }
  });
  return lines.join('');
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDE} ${DEEP}" width="${WIDE}" height="${DEEP}">` +
  '<defs>' +
  // Light from the window, falling across the boards and fading as it goes.
  '<linearGradient id="spill" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#f6e3b4" stop-opacity="0.34"/>' +
  '<stop offset="1" stop-color="#f6e3b4" stop-opacity="0"/>' +
  '</linearGradient>' +
  // The hearth's glow, and the darkness that gathers in the corners.
  '<radialGradient id="hearth" cx="0.5" cy="0.5" r="0.5">' +
  '<stop offset="0" stop-color="#e08a3c" stop-opacity="0.5"/>' +
  '<stop offset="1" stop-color="#e08a3c" stop-opacity="0"/>' +
  '</radialGradient>' +
  '<radialGradient id="corners" cx="0.5" cy="0.5" r="0.62">' +
  '<stop offset="0.45" stop-color="#000000" stop-opacity="0"/>' +
  '<stop offset="1" stop-color="#000000" stop-opacity="0.55"/>' +
  '</radialGradient>' +
  '</defs>' +
  // The stone the room is cut out of, which runs off the edge of the element into the same colour behind.
  `<rect width="${WIDE}" height="${DEEP}" fill="#211a16"/>` +
  `<rect x="${WALL - 26}" y="${WALL - 26}" width="${FLOOR_W + 52}" height="${FLOOR_D + 52}" fill="#3b3029"/>` +
  // The floor.
  `<rect x="${WALL}" y="${WALL}" width="${FLOOR_W}" height="${FLOOR_D}" fill="#8a6640"/>` +
  `<path d="${boards()}" stroke="#6d4e30" stroke-width="3" fill="none" opacity="0.75"/>` +
  // The window in the north wall, and the light it lets in.
  `<rect x="${WIDE / 2 - 190}" y="${WALL - 30}" width="380" height="30" fill="#cfe0e6"/>` +
  `<path d="M${WIDE / 2 - 190} ${WALL}L${WIDE / 2 + 190} ${WALL}L${WIDE / 2 + 290} ${WALL + 420}L${WIDE / 2 - 290} ${WALL + 420}Z" fill="url(#spill)"/>` +
  // The door in the south wall, standing open on a dark passage.
  `<rect x="${WIDE / 2 - 90}" y="${DEEP - WALL}" width="180" height="30" fill="#140f0c"/>` +
  `<rect x="${WIDE / 2 + 90}" y="${DEEP - WALL - 8}" width="14" height="150" rx="6" fill="#4a3624" transform="rotate(-24 ${WIDE / 2 + 90} ${DEEP - WALL})"/>` +
  // The hearth in the west wall.
  `<circle cx="${WALL}" cy="${DEEP / 2}" r="150" fill="url(#hearth)"/>` +
  `<path d="M${WALL - 40} ${DEEP / 2 - 82}a82 82 0 0 1 0 164Z" fill="#2a1d15"/>` +
  `<circle cx="${WALL + 6}" cy="${DEEP / 2}" r="26" fill="#d2702a"/>` +
  // The rug the desk stands on, big enough to show around it.
  `<rect x="${WIDE / 2 - 392}" y="${DEEP / 2 - 272}" width="784" height="544" rx="10" fill="#7a3b35"/>` +
  `<rect x="${WIDE / 2 - 356}" y="${DEEP / 2 - 240}" width="712" height="480" rx="6" fill="none" stroke="#c9a15a" stroke-width="9" opacity="0.72"/>` +
  `<rect x="${WIDE / 2 - 300}" y="${DEEP / 2 - 196}" width="600" height="392" rx="4" fill="#8c4a3e"/>` +
  // The chair, pushed back from where the desk's south edge falls.
  `<rect x="${WIDE / 2 - 62}" y="${DEEP / 2 + 214}" width="124" height="116" rx="16" fill="#54381f"/>` +
  `<rect x="${WIDE / 2 - 72}" y="${DEEP / 2 + 316}" width="144" height="26" rx="12" fill="#3f2917"/>` +
  // A chest in one corner and a shelf along the east wall, so the room has a use.
  `<rect x="${WALL + 44}" y="${WALL + 44}" width="186" height="118" rx="7" fill="#5b3f24"/>` +
  `<rect x="${WALL + 44}" y="${WALL + 92}" width="186" height="16" fill="#8d6a3a"/>` +
  `<rect x="${WIDE - WALL - 74}" y="${WALL + 120}" width="74" height="${FLOOR_D - 300}" fill="#4d3720"/>` +
  `<rect x="${WIDE - WALL - 74}" y="${WALL + 120}" width="74" height="${FLOOR_D - 300}" fill="none" stroke="#6e5130" stroke-width="8"/>` +
  // The corners, last, over everything.
  `<rect width="${WIDE}" height="${DEEP}" fill="url(#corners)"/>` +
  '</svg>';

/** The room as a CSS background image. */
export const roomFloor = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** What lies beyond the room's own rectangle, so the edge of the element is never the edge of anything. */
export const BEYOND = '#211a16';
