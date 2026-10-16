import { useJson } from './useJson';

/** A frame of a cut atlas: where it is, how big, whether it is still a placeholder, and the file it was cut from. */
export interface Frame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly placeholder: boolean;
  readonly source: string;
}

/** An atlas the tools cut, `public/art/<name>.json` beside its `.webp`, as much of it as the pages read. */
export interface Atlas {
  readonly version: string;
  readonly width: number;
  readonly height: number;
  readonly frames: Readonly<Record<string, Frame>>;
}

/**
 * What the dev server says when it has cut an atlas again: `ART_CUT` in `vite/artApi.ts` for the scenery and
 * `STRUCTURES_CUT` in `vite/structuresArtApi.ts` for the structures and their pins.
 */
const CUT: Readonly<Record<string, string>> = {
  scenery: 'villages:art-cut',
  structures: 'villages:structures-cut',
};

/** The atlas `public/art/<name>.json` names, read again whenever the dev server cuts it again. */
export function useAtlas(name: 'scenery' | 'structures'): Atlas | null | 'missing' {
  return useJson<Atlas>(`/art/${name}.json`, CUT[name]);
}

/** One frame of an atlas, cut out of it where the atlas says, scaled to [tall] pixels at most, and [wide] if given. */
export function Cut({
  name,
  atlas,
  image,
  frame,
  tall,
  wide = Infinity,
}: {
  name: string;
  atlas: Atlas;
  image: string;
  frame: Frame;
  tall: number;
  wide?: number;
}) {
  const scale = Math.min(1, tall / frame.height, wide / frame.width);
  return (
    <div
      className={frame.placeholder ? 'inspect-cut is-placeholder' : 'inspect-cut'}
      role="img"
      aria-label={name}
      title={`${name}: ${frame.placeholder ? 'a placeholder' : 'painted'}, ${frame.source}`}
      style={{
        width: frame.width * scale,
        height: frame.height * scale,
        backgroundImage: `url(${image}?v=${atlas.version})`,
        backgroundSize: `${atlas.width * scale}px ${atlas.height * scale}px`,
        backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
      }}
    />
  );
}
