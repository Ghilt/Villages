import { facesSvg } from '../src/blockOut.ts';
import { BRIDGE_WAYS } from '../src/bridgeModel.ts';
import { renderBridge } from '../src/bridgeRender.ts';
import {
  CUT_PER_UNIT,
  DRAWN_PER_UNIT,
  JETTY_AXES,
  SETTLEMENT_PIECES,
  bridgeFile,
  jettyFaces,
  jettyFile,
  keyOfBridgeFile,
  keyOfSettlementFile,
  settlementPieceFaces,
  settlementPieceFile,
} from '../src/settlementLooks.ts';
import { keyOfStructureFile, structurePictureFile } from '../src/structureArt.ts';
import {
  DRAWN_CULTURES,
  DRAWN_TYPES,
  RUIN_PICTURE,
  pictureFor,
  pictureSvg,
  styled,
} from '../src/structureLooks.ts';
import { keyOfStructureMarkFile, structureMarkFile, structureMarkSvg } from '../src/structureMarks.ts';
import { CULTURES } from '../src/structures.ts';

import {
  cutAtlas,
  drawMissing,
  drawMissingPicture,
  folderOf,
  picturesIn,
  savePlaceholders,
} from './lib/cutBuildings.ts';
import { ART_DIR, BRIDGES_DIR, SETTLEMENTS_DIR, STRUCTURE_MARKS_DIR, STRUCTURES_DIR } from './lib/paths.ts';

/**
 * The pictures of structures, one a type and a culture and a ruin a culture, cut into one atlas; and the pictures of
 * the settlements' pieces and the bridges, cut into another.
 *
 *   node bin/cutStructures.ts
 *
 * First it draws a placeholder for every picture `world/sprites/structures/` has none of, from the same shapes the
 * map draws in code, and remembers what it drew in `placeholders.json` there, so a picture saved over one is known to
 * be Adam's and is never drawn over. Then it crops every picture to what is drawn in it, scales it to one height,
 * finds where a pennant stands on it and where it stands on the ground, casts its shadow, and packs them all into
 * `public/art/structures.webp` with `structures.json` beside it, which the map draws from where it has a picture and
 * draws in code where it has none. The marks of `world/sprites/marks/structures/`, a pin a type and the ruin's, are drawn
 * and cut the same way into the same atlas, with a record of their own.
 *
 * Then the same for `world/sprites/settlements/` - a cottage, a house, a barn, a chapel, a fishing hut, a net rack and a
 * boat in every culture, and a jetty along each axis - and `world/sprites/bridges/`, the bridge along each of its eight
 * ways, modelled in 3D (`bridgeModel.ts`): placeholders drawn in the map's own camera at `DRAWN_PER_UNIT` pixels to the world unit, the
 * scale a picture painted over one keeps, cut at `CUT_PER_UNIT` into `public/art/settlements.webp`, each frame saying how
 * many world units it stands. Nothing is written when nothing is new. Seconds. See docs/plans/structures.md and
 * docs/plans/settlements-and-roads.md.
 */

/** How tall every structure's picture is cut, in pixels: the map lays a structure out 160 tall, as its castle is. */
const HEIGHT = 160;
/** How big a structure's placeholder is drawn, before it is cropped and scaled. */
const DRAWN = 384;

const pictures = await folderOf(STRUCTURES_DIR, keyOfStructureFile);
const marks = await folderOf(STRUCTURE_MARKS_DIR, keyOfStructureMarkFile);
const pieces = await folderOf(SETTLEMENTS_DIR, keyOfSettlementFile);
const bridges = await folderOf(BRIDGES_DIR, keyOfBridgeFile);

// Draw what is missing, never over a file that is there.
let drawn = 0;
const draw = async (...args: Parameters<typeof drawMissing>) => {
  if (await drawMissing(...args)) drawn += 1;
};
for (const picture of [...DRAWN_TYPES, RUIN_PICTURE]) {
  for (const culture of DRAWN_CULTURES) {
    await draw(pictures, structurePictureFile(picture, culture), () =>
      pictureSvg(styled(pictureFor(picture, picture === RUIN_PICTURE), culture), DRAWN),
    );
  }
  await draw(marks, structureMarkFile(picture), () => structureMarkSvg(picture, DRAWN));
}
for (const piece of SETTLEMENT_PIECES) {
  for (const culture of CULTURES) {
    await draw(pieces, settlementPieceFile(piece, culture), () =>
      facesSvg(settlementPieceFaces(piece, culture), DRAWN_PER_UNIT),
    );
  }
}
for (const axis of JETTY_AXES) {
  await draw(pieces, jettyFile(axis), () => facesSvg(jettyFaces(axis), DRAWN_PER_UNIT));
}
// The bridge is modelled in 3D and drawn three times larger, so its edges are smooth once it is shrunk.
for (const way of BRIDGE_WAYS) {
  if (await drawMissingPicture(bridges, bridgeFile(way), () => renderBridge(way, DRAWN_PER_UNIT, 3), 3))
    drawn += 1;
}

const structures = await cutAtlas(
  [
    ...(await picturesIn(pictures)).map(({ from, file }) => ({
      from,
      file,
      source: file,
      pin: false,
      stands: 'corner' as const,
    })),
    ...(await picturesIn(marks)).map(({ from, file }) => ({
      from,
      file,
      source: `../marks/structures/${file}`,
      pin: true,
      stands: 'corner' as const,
    })),
  ],
  { tall: HEIGHT },
  ART_DIR,
  'structures',
);
const settlements = await cutAtlas(
  [
    ...(await picturesIn(pieces)).map(({ from, file }) => ({
      from,
      file,
      source: file,
      pin: false,
      stands: file.startsWith('jetty-') ? ('middle' as const) : ('corner' as const),
    })),
    ...(await picturesIn(bridges)).map(({ from, file }) => ({
      from,
      file,
      source: `../bridges/${file}`,
      pin: false,
      stands: 'centre' as const,
    })),
  ],
  { drawnPerUnit: DRAWN_PER_UNIT, cutPerUnit: CUT_PER_UNIT },
  ART_DIR,
  'settlements',
);
await savePlaceholders([pictures, marks, pieces, bridges]);
console.log(`${structures}${drawn > 0 ? `, ${drawn} drawn just now` : ''}`);
console.log(settlements);
