import './pictures.css';

import { useEffect, useState } from 'react';

import { CULTURES, RUIN_PIECES, markKey, pictureKey, ruinFrameKey } from '@villages/world';

import { Cut, useAtlas } from '../frame/Atlas';
import type { Atlas } from '../frame/Atlas';
import { InspectPage } from '../frame/InspectPage';
import { useJson } from '../frame/useJson';

/** How tall a picture is drawn on the page, at most. */
const TALL = 96;

/** The folder of `world/sprites/marks/` whose pins are shown with the structures, cut into their atlas. */
const PINS = 'structures/';

/**
 * Every picture the world is drawn with, for reading: the scenery and the structures as the tools cut them into their
 * atlases, a structure a culture to a column beside its type's pin; the pieces of the ruins of the towns of 1790, cut
 * into the scenery's atlas, a piece to a row and a culture to a column; the critters, a kind's frames in a row and playing
 * beside them; the marks' pictures; the portraits; the scenes. Each says whether it is
 * still the placeholder the tools drew or a picture painted over it, how big it is, and the file it came from; the
 * portraits and the scenes keep no record of which are placeholders. Nothing here is changed: Adam paints the files,
 * and `AUTHORING-THE-ART.md` says how. See docs/plans/catalogues.md.
 */
export function Pictures() {
  const scenery = useAtlas('scenery');
  const structures = useAtlas('structures');
  const settlements = useAtlas('settlements');
  const critters = useAtlas<CritterAtlas>('critters');
  const marks = useJson<{ marks: { key: string; placeholder: boolean }[] }>('/sprite-marks/');
  const portraits = useJson<{ portraits: string[] }>('/portraits/');
  const scenes = useJson<{ scenes: string[] }>('/scenes/');
  return (
    <InspectPage
      title="Pictures"
      epigraph="Every picture the world is drawn with: painted, or still a placeholder"
    >
      <Section title="scenery" source="world/sprites/scenery/, cut to public/art/scenery.webp">
        {scenery === 'missing' ? (
          <Missing what="world:art" />
        ) : (
          scenery !== null && (
            <AtlasGrid name="scenery" atlas={scenery} keep={(key) => !key.startsWith('ruin:')} />
          )
        )}
      </Section>
      <Section
        title="ruins"
        source="world/sprites/ruins/, cut into public/art/scenery.webp beside the scenery"
      >
        {scenery === 'missing' ? (
          <Missing what="world:art" />
        ) : (
          scenery !== null && <RuinsTable atlas={scenery} />
        )}
      </Section>
      <Section title="structures" source="world/sprites/structures/, cut to public/art/structures.webp">
        {structures === 'missing' ? (
          <Missing what="world:structures" />
        ) : (
          structures !== null && <StructuresTable atlas={structures} />
        )}
      </Section>
      <Section
        title="settlements and bridges"
        source="world/sprites/settlements/ and world/sprites/bridges/, cut to public/art/settlements.webp"
      >
        {settlements === 'missing' ? (
          <Missing what="world:structures" />
        ) : (
          settlements !== null && <AtlasGrid name="settlements" atlas={settlements} />
        )}
      </Section>
      <Section title="critters" source="world/sprites/critters/, cut to public/art/critters.webp">
        {critters === 'missing' ? (
          <Missing what="world:critters" />
        ) : (
          critters !== null && <CrittersList atlas={critters} />
        )}
      </Section>
      <Section title="marks" source="world/sprites/marks/">
        <p className="inspect-note">
          the structures' pins, {`world/sprites/marks/${PINS}`}, are with the structures
        </p>
        {marks !== null && marks !== 'missing' && (
          <ul className="pictures-grid">
            {marks.marks
              .filter((mark) => !mark.key.startsWith(PINS))
              .map((mark) => (
                <Picture
                  key={mark.key}
                  name={mark.key}
                  src={`/sprite-marks/${mark.key}.png`}
                  placeholder={mark.placeholder}
                />
              ))}
          </ul>
        )}
      </Section>
      <Section title="portraits" source="world/portraits/">
        {portraits !== null && portraits !== 'missing' && (
          <ul className="pictures-grid">
            {portraits.portraits.map((key) => (
              <Picture key={key} name={key} src={`/portraits/${key}.png`} />
            ))}
          </ul>
        )}
      </Section>
      <Section title="scenes" source="world/scenes/">
        {scenes !== null && scenes !== 'missing' && (
          <ul className="pictures-grid pictures-grid--wide">
            {scenes.scenes.map((key) => (
              <Picture key={key} name={key} src={`/scenes/${key}.png`} tall={200} />
            ))}
          </ul>
        )}
      </Section>
    </InspectPage>
  );
}

function Section({ title, source, children }: { title: string; source: string; children: React.ReactNode }) {
  return (
    <section className="inspect-group" aria-label={title}>
      <h2 className="inspect-group__title">
        {title} <span className="inspect-key">{source}</span>
      </h2>
      {children}
    </section>
  );
}

function Missing({ what }: { what: string }) {
  return (
    <p className="inspect-quiet">
      not cut in this tree yet: npm run {what} --prefix frontend, or the quick start
    </p>
  );
}

/** A picture on its own, read whole: its name, how big it is, and whether it is a placeholder when that is known. */
function Picture({
  name,
  src,
  placeholder,
  tall = TALL,
}: {
  name: string;
  src: string;
  placeholder?: boolean;
  tall?: number;
}) {
  const [size, setSize] = useState<string>('');
  return (
    <li className="pictures-cell">
      <img
        className="pictures-image"
        src={src}
        alt={name}
        style={{ maxHeight: tall }}
        onLoad={(event) =>
          setSize(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`)
        }
      />
      <span className="pictures-name">{name}</span>
      <span className="inspect-key">
        {size}
        {placeholder === undefined ? '' : placeholder ? ' · placeholder' : ' · painted'}
      </span>
    </li>
  );
}

function AtlasGrid({
  name,
  atlas,
  keep = () => true,
}: {
  name: string;
  atlas: Atlas;
  keep?: (key: string) => boolean;
}) {
  const frames = Object.entries(atlas.frames).filter(([key]) => keep(key));
  const painted = frames.filter(([, frame]) => !frame.placeholder).length;
  return (
    <>
      <p className="inspect-note">
        {frames.length} pictures, {painted} painted, {frames.length - painted} placeholders
      </p>
      <ul className="pictures-grid">
        {frames.map(([key, frame]) => (
          <li key={key} className="pictures-cell">
            <Cut name={key} atlas={atlas} image={`/art/${name}.webp`} frame={frame} tall={TALL} />
            <span className="pictures-name">{key}</span>
            <span className="inspect-key">
              {frame.width} × {frame.height} · {frame.placeholder ? 'placeholder' : 'painted'} ·{' '}
              {frame.source}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The structures a type to a row and a culture to a column, as their atlas names them, `castle@european`, with each
 * type's pin beside them, `mark:castle`, cut into the same atlas.
 */
function StructuresTable({ atlas }: { atlas: Atlas }) {
  const frames = Object.entries(atlas.frames);
  const types = [...new Set(frames.filter(([key]) => key.includes('@')).map(([key]) => key.split('@')[0]!))];
  const painted = frames.filter(([, frame]) => !frame.placeholder).length;
  return (
    <>
      <p className="inspect-note">
        {frames.length} pictures, {painted} painted, {frames.length - painted} placeholders; the gold tick
        under each building is where it stands on the ground, the front corner of its base
      </p>
      <div className="inspect-scroll">
        <table className="inspect-table pictures-table">
          <thead>
            <tr>
              <th>type</th>
              <th>pin</th>
              {CULTURES.map((culture) => (
                <th key={culture}>{culture}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((type) => (
              <tr key={type}>
                <th scope="row">{type}</th>
                {[markKey(type), ...CULTURES.map((culture) => pictureKey(type, culture))].map((key) => {
                  const frame = atlas.frames[key];
                  return (
                    <td key={key}>
                      {frame === undefined ? (
                        <span className="inspect-quiet">none</span>
                      ) : (
                        <>
                          <Cut
                            name={key}
                            atlas={atlas}
                            image="/art/structures.webp"
                            frame={frame}
                            tall={TALL}
                            foot={key.includes('@') ? frame.footX : undefined}
                          />
                          <span className="inspect-key">{frame.placeholder ? 'placeholder' : 'painted'}</span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * The pieces of the ruins a piece to a row and a culture to a column, as the scenery's atlas names them,
 * `ruin:hall-islamic`, each with the height it is cut at, which is the height to paint it at or above.
 */
function RuinsTable({ atlas }: { atlas: Atlas }) {
  const keys = RUIN_PIECES.flatMap((piece) => CULTURES.map((culture) => ruinFrameKey(piece, culture)));
  const painted = keys.filter((key) => atlas.frames[key]?.placeholder === false).length;
  return (
    <>
      <p className="inspect-note">
        {keys.length} pieces, {painted} painted, {keys.length - painted} placeholders
      </p>
      <div className="inspect-scroll">
        <table className="inspect-table pictures-table">
          <thead>
            <tr>
              <th>piece</th>
              {CULTURES.map((culture) => (
                <th key={culture}>{culture}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RUIN_PIECES.map((piece) => (
              <tr key={piece}>
                <th scope="row">{piece}</th>
                {CULTURES.map((culture) => {
                  const key = ruinFrameKey(piece, culture);
                  const frame = atlas.frames[key];
                  return (
                    <td key={key}>
                      {frame === undefined ? (
                        <span className="inspect-quiet">none</span>
                      ) : (
                        <>
                          <Cut name={key} atlas={atlas} image="/art/scenery.webp" frame={frame} tall={TALL} />
                          <span className="inspect-key">
                            {frame.placeholder ? 'placeholder' : 'painted'} · cut {frame.height} tall
                          </span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** The critters' atlas, which names each kind's frames in order beside the frames themselves. */
interface CritterAtlas extends Atlas {
  readonly kinds: Readonly<
    Record<string, { frames: readonly string[]; placeholder: boolean; source: string }>
  >;
}

/** How fast a critter's frames are played beside them: about the beat of a small bird's wings, slowed to be seen. */
const PLAYED_MS = 160;

/** Each kind a row: its frames in order as the strip holds them, then the strip played, one frame after another. */
function CrittersList({ atlas }: { atlas: CritterAtlas }) {
  const kinds = Object.entries(atlas.kinds);
  const painted = kinds.filter(([, kind]) => !kind.placeholder).length;
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const ticking = setInterval(() => setBeat((was) => was + 1), PLAYED_MS);
    return () => clearInterval(ticking);
  }, []);
  return (
    <>
      <p className="inspect-note">
        {kinds.length} kinds, {painted} painted, {kinds.length - painted} placeholders: each picture is its
        frames side by side, as many as world/critters.json says
      </p>
      <ul className="pictures-grid pictures-grid--wide">
        {kinds.map(([name, kind]) => {
          const playing = kind.frames[beat % kind.frames.length]!;
          return (
            <li key={name} className="pictures-cell">
              <div className="pictures-strip">
                {kind.frames.map((key) => (
                  <Cut
                    key={key}
                    name={key}
                    atlas={atlas}
                    image="/art/critters.webp"
                    frame={atlas.frames[key]!}
                    tall={48}
                  />
                ))}
                <span className="pictures-played" aria-hidden="true">
                  <Cut
                    name={playing}
                    atlas={atlas}
                    image="/art/critters.webp"
                    frame={atlas.frames[playing]!}
                    tall={48}
                  />
                </span>
              </div>
              <span className="pictures-name">{name}</span>
              <span className="inspect-key">
                {kind.frames.length} frames · {kind.placeholder ? 'placeholder' : 'painted'} · {kind.source}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
