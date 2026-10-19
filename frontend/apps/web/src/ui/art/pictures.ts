import { useSyncExternalStore } from 'react';

import { UI_LIST_IN_PAGE } from '@villages/world';
import type { UiArtFile, UiKind, UiPicture } from '@villages/world';

/**
 * The interface's pictures, as `npm run world:ui` cut them: read once from `/ui/ui.json`, and read again
 * whenever the dev server says it cut them again, so a picture saved over a placeholder is on the page a
 * moment later with no reload.
 *
 * Every component that draws a picture asks for it here by kind and name, and gets back the files it was
 * cut into; the browser picks the one for its screen. See decision record 0068.
 */

/** What the dev server says when it has cut the pictures again, `UI_CUT` in `vite/uiArtApi.ts`. */
const UI_CUT = 'villages:ui-cut';

const LIST = '/ui/ui.json';

export interface Pictures {
  /** The list as last read, or null before it has been, and when it could not be. */
  readonly list: UiArtFile | null;
  /** Why there is no list, in words, when there is not one. */
  readonly problem: string | null;
}

/**
 * The list the page was served with, written into it by the dev server and the build (`vite/uiInPage.ts`), so the
 * first frame draws its pictures without asking for the list first. Null where it was not.
 */
function servedWith(): UiArtFile | null {
  const written = globalThis.document?.getElementById(UI_LIST_IN_PAGE)?.textContent;
  if (written === undefined || written === null || written === '') {
    return null;
  }
  try {
    return JSON.parse(written) as UiArtFile;
  } catch {
    return null;
  }
}

let now: Pictures = { list: servedWith(), problem: null };
const listeners = new Set<() => void>();
let asked = false;

function tell(next: Pictures): void {
  now = next;
  for (const listener of listeners) {
    listener();
  }
}

async function read(): Promise<void> {
  try {
    const response = await fetch(LIST, { cache: 'no-store' });
    if (!response.ok) {
      tell({
        list: null,
        problem:
          response.status === 404
            ? 'No pictures are cut in this tree yet: npm run world:ui --prefix frontend -- --placeholders'
            : `${LIST} answered ${response.status}`,
      });
      return;
    }
    const list = (await response.json()) as UiArtFile;
    if (now.list?.version !== list.version) {
      tell({ list, problem: null });
    }
  } catch (cause) {
    tell({ list: null, problem: `${LIST} could not be read: ${(cause as Error).message}` });
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!asked) {
    asked = true;
    void read();
    import.meta.hot?.on(UI_CUT, () => void read());
  }
  return () => listeners.delete(listener);
}

/** The pictures, kept current. */
export function usePictures(): Pictures {
  return useSyncExternalStore(subscribe, () => now);
}

/** One picture by its kind and name, or undefined when the list has no such picture. */
export function pictureIn(list: UiArtFile | null, kind: UiKind, name: string): UiPicture | undefined {
  return list?.pictures.find((picture) => picture.kind === kind && picture.name === name);
}

/**
 * A picture as CSS asks for one it may pick the density of: `image-set(url(...) 1x, url(...) 2x, ...)`.
 * The browser takes the one for the screen it is on, and takes another when the window moves to a
 * sharper one or is zoomed.
 */
export function imageSetOf(picture: UiPicture): string {
  return `image-set(${picture.cuts.map((cut) => `url("${cut.url}") ${cut.density}x`).join(', ')})`;
}

/** The same for an `<img>`: its `srcset`, and the file to fall back on. */
export function sourcesOf(picture: UiPicture): { src: string; srcSet: string } {
  const plain = picture.cuts.find((cut) => cut.density === 1) ?? picture.cuts[0];
  return {
    src: plain?.url ?? '',
    srcSet: picture.cuts.map((cut) => `${cut.url} ${cut.density}x`).join(', '),
  };
}
