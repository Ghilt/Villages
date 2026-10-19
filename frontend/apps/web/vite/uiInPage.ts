import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { HtmlTagDescriptor, Plugin } from 'vite';

// Reached by relative paths for the reason `worldApi.ts` gives: Vite bundles a config's relative imports itself.
import { UI_LIST_IN_PAGE } from '../../../packages/world/src/uiArt.ts';
import type { UiArtFile, UiKind } from '../../../packages/world/src/uiArt.ts';

const here = dirname(fileURLToPath(import.meta.url));
const LIST = resolve(here, '..', 'public', 'ui', 'ui.json');

/** Every picture the loading screen draws, which `ui/loadingScreen/pictures.test.ts` holds to its recipes. */
export const LOADING_SCREEN_PICTURES = JSON.parse(
  readFileSync(resolve(here, '..', 'src', 'ui', 'loadingScreen', 'pictures.json'), 'utf8'),
) as readonly { readonly kind: UiKind; readonly name: string }[];

/**
 * Serves the page with the interface's pictures already on their way: the list of them written into it, so the
 * first frame has it without asking, and the loading screen's own pictures asked for as the page is read, while
 * its code is still arriving. Without it the screen's plate and frame came three trips after the screen did - the
 * code, then the list, then the pictures - each small, and each behind a page busy starting the map.
 *
 * In the dev server and the build alike; nothing at all in a tree whose pictures are not cut. See UI-COMPONENTS.md.
 */
export function uiInPage(): Plugin {
  return {
    name: 'villages-ui-in-page',
    transformIndexHtml: () =>
      existsSync(LIST) ? pageTagsOf(JSON.parse(readFileSync(LIST, 'utf8')) as UiArtFile) : [],
  };
}

/** The tags the page is served with for a list of pictures: the list, and a request for each picture the screen draws. */
export function pageTagsOf(list: UiArtFile): HtmlTagDescriptor[] {
  const asked = LOADING_SCREEN_PICTURES.flatMap(({ kind, name }) =>
    list.pictures.filter((picture) => picture.kind === kind && picture.name === name),
  );
  return [
    ...asked.map((picture): HtmlTagDescriptor => ({
      tag: 'link',
      attrs: {
        rel: 'preload',
        as: 'image',
        fetchpriority: 'high',
        // The browser picks the density from these as it will from the image-set the picture is drawn with.
        imagesrcset: picture.cuts.map((cut) => `${cut.url} ${cut.density}x`).join(', '),
      },
      injectTo: 'head',
    })),
    {
      tag: 'script',
      attrs: { type: 'application/json', id: UI_LIST_IN_PAGE },
      // Nothing in it may close the script it stands in.
      children: JSON.stringify(list).replaceAll('<', '\\u003c'),
      injectTo: 'head',
    },
  ];
}
