import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizePath } from 'vite';
import type { HtmlTagDescriptor, IndexHtmlTransformContext, Plugin } from 'vite';

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
 * The faces the loading screen's words are set in, EB Garamond's Latin: upright for its title, italic for the line
 * under it. Drawn in a fallback first and in these once they arrived, the words moved.
 */
const FACES = ['eb-garamond-latin-wght-normal', 'eb-garamond-latin-wght-italic'];
const FACES_DIR = resolve(
  here,
  '..',
  '..',
  '..',
  'node_modules',
  '@fontsource-variable',
  'eb-garamond',
  'files',
);

/**
 * Serves the page with the loading screen's pictures and faces already on their way, so its first frame is drawn
 * whole and nothing on it moves after: the list of the interface's pictures written into it, so the first frame has
 * it without asking, and the screen's own pictures and faces asked for as the page is read, while its code is still
 * arriving. Without it the screen's plate and frame came three trips after the screen did - the code, then the list,
 * then the pictures - each small, and each behind a page busy starting the map.
 *
 * In the dev server and the build alike; no pictures in a tree whose pictures are not cut. See UI-COMPONENTS.md.
 */
export function uiInPage(): Plugin {
  return {
    name: 'villages-ui-in-page',
    transformIndexHtml: (_html, context) =>
      pageTagsOf(
        existsSync(LIST) ? (JSON.parse(readFileSync(LIST, 'utf8')) as UiArtFile) : null,
        facesIn(context),
      ),
  };
}

/** Where the page finds each face: the dev server serves the package's own file, and a build its copy, renamed. */
function facesIn(context: IndexHtmlTransformContext): string[] {
  const { bundle } = context;
  if (bundle === undefined) {
    return FACES.map((face) => `/@fs/${normalizePath(resolve(FACES_DIR, `${face}.woff2`))}`);
  }
  const files = Object.values(bundle).map((out) => out.fileName);
  return FACES.flatMap((face) =>
    files.filter((file) => file.includes(`${face}-`) && file.endsWith('.woff2')).map((file) => `/${file}`),
  );
}

/**
 * The tags the page is served with: a request for each face and each picture the loading screen draws, and the list
 * of the interface's pictures itself, when there is one.
 */
export function pageTagsOf(list: UiArtFile | null, faces: readonly string[]): HtmlTagDescriptor[] {
  const pictures = LOADING_SCREEN_PICTURES.flatMap(({ kind, name }) =>
    (list?.pictures ?? []).filter((picture) => picture.kind === kind && picture.name === name),
  );
  return [
    ...faces.map((href): HtmlTagDescriptor => ({
      tag: 'link',
      // A face is fetched as though from another origin, and a request made ahead is used only if it was made so.
      attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: 'anonymous', href },
      injectTo: 'head',
    })),
    ...pictures.map((picture): HtmlTagDescriptor => ({
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
    ...(list === null
      ? []
      : [
          {
            tag: 'script',
            attrs: { type: 'application/json', id: UI_LIST_IN_PAGE },
            // Nothing in it may close the script it stands in.
            children: JSON.stringify(list).replaceAll('<', '\\u003c'),
            injectTo: 'head' as const,
          },
        ]),
  ];
}
