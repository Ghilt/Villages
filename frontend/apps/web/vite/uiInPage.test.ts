import { describe, expect, it } from 'vitest';

import type { UiArtFile, UiKind, UiPicture } from '../../../packages/world/src/uiArt.ts';
import { LOADING_SCREEN_PICTURES, pageTagsOf } from './uiInPage.ts';

/** A picture cut at the three densities, its files named for it. */
function picture(kind: UiKind, name: string): UiPicture {
  return {
    kind,
    name,
    source: `${kind}/${name}.webp`,
    placeholder: false,
    width: 10,
    height: 10,
    painted: { width: 40, height: 40 },
    how: 'opaque',
    cuts: [1, 2, 3].map((density) => ({
      density,
      url: `/ui/${kind}/${name}@${density}x.webp`,
      width: 10 * density,
      height: 10 * density,
      bytes: 100,
    })),
  };
}

const LIST: UiArtFile = {
  version: 'v1',
  cutAt: '2026-10-19T00:00:00.000Z',
  paintedAt: 4,
  pictures: [
    ...LOADING_SCREEN_PICTURES.map(({ kind, name }) => picture(kind, name)),
    { ...picture('borders', 'gilt-simple'), about: 'nothing to close </script> with' },
  ],
};

describe('the page served with its pictures on their way', () => {
  it('asks for every picture the loading screen draws, at every density, and for no other', () => {
    const asked = pageTagsOf(LIST, []).filter((tag) => tag.tag === 'link');

    expect(asked).toHaveLength(LOADING_SCREEN_PICTURES.length);
    expect(asked[0]?.attrs).toMatchObject({ rel: 'preload', as: 'image' });
    const { kind, name } = LOADING_SCREEN_PICTURES[0]!;
    expect(asked[0]?.attrs?.['imagesrcset']).toBe(
      `/ui/${kind}/${name}@1x.webp 1x, /ui/${kind}/${name}@2x.webp 2x, /ui/${kind}/${name}@3x.webp 3x`,
    );
  });

  it('writes the whole list into the page, so that nothing in it can close the script it stands in', () => {
    const written = pageTagsOf(LIST, []).find((tag) => tag.tag === 'script');

    expect(written?.attrs).toMatchObject({ type: 'application/json', id: 'ui-pictures' });
    expect(written?.children).not.toContain('<');
    expect(JSON.parse(written?.children as string)).toEqual(LIST);
  });

  it('asks for the faces the words are set in, as a face is fetched, whether or not there are pictures', () => {
    const faces = pageTagsOf(null, ['/faces/upright.woff2', '/faces/italic.woff2']);

    expect(faces.map((tag) => tag.attrs)).toEqual([
      {
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        crossorigin: 'anonymous',
        href: '/faces/upright.woff2',
      },
      {
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        crossorigin: 'anonymous',
        href: '/faces/italic.woff2',
      },
    ]);
  });
});
