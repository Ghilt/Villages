import { ImageSource } from 'pixi.js';

import { begin } from '../loading/inHand';

/**
 * Reads an atlas a tool cut beside the page: its frames first, then the picture they point into, by its version so
 * a picture cut again is fetched again. Null when it was never cut; it throws when it could not be read. In hand
 * while it is read, so the loading screen waits for it, said as `what`.
 *
 * Premultiplied by the browser as it decodes, and said to be, so that nothing multiplies it twice or not at all.
 * Left straight, the see-through pixels keep a colour, and a colour blended as if it were premultiplied draws every
 * sprite on a faint box of whatever its transparent pixels held. The browser builds the mipmaps itself, which is
 * what lets one picture 160 pixels tall be drawn at twenty without sparkling.
 */
export async function readAtlas<F extends { readonly version: string }>(
  art: string,
  what: string,
): Promise<{ file: F; source: ImageSource } | null> {
  const done = begin(what);
  try {
    const listed = await fetch(`${art}.json`, { cache: 'no-store' });
    if (!listed.ok) {
      return null;
    }
    const file = (await listed.json()) as F;
    const picture = await fetch(`${art}.webp?v=${file.version}`);
    const bitmap = await createImageBitmap(await picture.blob(), { premultiplyAlpha: 'premultiply' });
    const source = new ImageSource({
      resource: bitmap,
      alphaMode: 'premultiplied-alpha',
      autoGenerateMipmaps: true,
      scaleMode: 'linear',
    });
    return { file, source };
  } finally {
    done();
  }
}
