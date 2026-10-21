import { useEffect, useState } from 'react';

import type { ArtAtlasFile, StructureAtlasFile } from '@villages/world';

import type { Sheet, Standing } from '../ui/diorama/Diorama';

/** The map's two sheets a venue is built from: its buildings and its scenery, as the tools cut them. */
export interface Sheets {
  readonly structures: StructureAtlasFile;
  readonly scenery: ArtAtlasFile;
}

let read: Promise<Sheets | null> | undefined;

/** Both sheets' descriptions, fetched once for the page however many spectacles it shows. */
function readSheets(): Promise<Sheets | null> {
  read ??= Promise.all([fetch('/art/structures.json'), fetch('/art/scenery.json')])
    .then(async ([structures, scenery]) =>
      structures.ok && scenery.ok
        ? {
            structures: (await structures.json()) as StructureAtlasFile,
            scenery: (await scenery.json()) as ArtAtlasFile,
          }
        : null,
    )
    .catch(() => null);
  return read;
}

/** The map's sheets, once they are read: null until then, `missing` when this tree has not cut them. */
export function useSheets(): Sheets | null | 'missing' {
  const [sheets, setSheets] = useState<Sheets | null | 'missing'>(null);
  useEffect(() => {
    let live = true;
    void readSheets().then((found) => {
      if (live) setSheets(found ?? 'missing');
    });
    return () => {
      live = false;
    };
  }, []);
  return sheets;
}

/** A building of the map's standing at (x, y), `height` tall: `palace@european`, its foot the front corner of its base. */
export function building(
  sheets: Sheets,
  key: string,
  x: number,
  y: number,
  height: number,
  seen = 1,
): Standing | null {
  const frame = sheets.structures.frames[key];
  if (frame === undefined) {
    return null;
  }
  const sheet: Sheet = {
    src: `/art/structures.webp?v=${sheets.structures.version}`,
    width: sheets.structures.width,
    height: sheets.structures.height,
  };
  return { id: `${key}@${x},${y}`, sheet, frame, foot: { x: frame.footX, y: 1 }, x, y, height, seen };
}

/** A tree or a stone of the map's scenery standing at (x, y), `height` tall. */
export function scenery(sheets: Sheets, kind: string, x: number, y: number, height: number): Standing | null {
  const frame = sheets.scenery.frames[kind];
  if (frame === undefined) {
    return null;
  }
  const sheet: Sheet = {
    src: `/art/scenery.webp?v=${sheets.scenery.version}`,
    width: sheets.scenery.width,
    height: sheets.scenery.height,
  };
  return {
    id: `${kind}@${x},${y}`,
    sheet,
    frame,
    foot: { x: frame.footX / frame.width, y: frame.footY / frame.height },
    x,
    y,
    height,
  };
}
