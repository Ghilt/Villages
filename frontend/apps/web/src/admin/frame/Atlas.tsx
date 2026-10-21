import { useJson } from './useJson';

/** A frame of a cut atlas: where it is, how big, whether it is still a placeholder, and the file it was cut from. */
export interface Frame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly placeholder: boolean;
  readonly source: string;
  /** Where a building stands across its picture, as a fraction of its width: the structures' atlas alone says. */
  readonly footX?: number;
  /** Where a bridge stands down its picture, as a fraction of its height: the settlements' atlas says. */
  readonly footY?: number;
  /** How many world units it stands, for a picture cut at a scale: the settlements' atlas says. */
  readonly tall?: number;
}

/** An atlas the tools cut, `public/art/<name>.json` beside its `.webp`, as much of it as the pages read. */
export interface Atlas {
  readonly version: string;
  readonly width: number;
  readonly height: number;
  readonly frames: Readonly<Record<string, Frame>>;
}

/**
 * What the dev server says when it has cut an atlas again: `ART_CUT` in `vite/artApi.ts` for the scenery,
 * `STRUCTURES_CUT` in `vite/structuresArtApi.ts` for the structures and their pins, and `CRITTERS_CUT` in
 * `vite/crittersArtApi.ts` for the critters.
 */
const CUT: Readonly<Record<string, string>> = {
  scenery: 'villages:art-cut',
  structures: 'villages:structures-cut',
  settlements: 'villages:structures-cut',
  critters: 'villages:critters-cut',
};

/** The atlas `public/art/<name>.json` names, read again whenever the dev server cuts it again. */
export function useAtlas<A extends Atlas = Atlas>(
  name: 'scenery' | 'structures' | 'settlements' | 'critters',
): A | null | 'missing' {
  return useJson<A>(`/art/${name}.json`, CUT[name]);
}

/**
 * One frame of an atlas, cut out of it where the atlas says, scaled to [tall] pixels at most, and [wide] if given; with
 * [foot], a tick under it where it stands on the ground, as a fraction of its width.
 */
export function Cut({
  name,
  atlas,
  image,
  frame,
  tall,
  wide = Infinity,
  foot,
}: {
  name: string;
  atlas: Atlas;
  image: string;
  frame: Frame;
  tall: number;
  wide?: number;
  foot?: number | undefined;
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
    >
      {foot !== undefined && <span className="inspect-foot" style={{ left: `${foot * 100}%` }} />}
    </div>
  );
}
