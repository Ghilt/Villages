import { PAINTED_AT, UI_BUDGET, UI_KINDS, weightAt } from '@villages/world';
import type { UiKind, UiPicture } from '@villages/world';

import { sourcesOf, usePictures } from '../../ui/art/pictures';
import { Part, Specimen, Specimens } from './Specimen';

/** What each kind of picture is for, in a line, above its pictures. */
const KINDS: Record<UiKind, { title: string; says: string }> = {
  borders: {
    title: 'Borders',
    says: 'A whole framed box, and a file beside it of where its four cuts go. Shown whole here; sliced in the next section.',
  },
  fills: { title: 'Fills', says: 'What fills a border: a picture that repeats without a seam.' },
  embellishments: {
    title: 'Embellishments',
    says: 'Anything pinned to a container that is not part of its border: a cherub, a cross, a drape.',
  },
  medallions: { title: 'Medallions', says: 'A round or oval frame, one fixed picture, never sliced.' },
  marks: { title: 'Marks', says: 'Only the marks chosen to be painted; the rest are drawn in code.' },
  controls: { title: 'Controls', says: 'A button’s face at rest, hovered, pressed and disabled.' },
};

const kilobytes = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * Every picture in `world/ui/`, as it was cut: at the size it is shown, with what it weighs at each
 * density and whether it is still a placeholder. The one place a picture is seen on its own, before a
 * component lays it.
 */
export function Pictures() {
  const { list, problem } = usePictures();
  if (list === null) {
    return <p className="showcase__to-come">{problem ?? 'Reading the pictures…'}</p>;
  }
  const weight = weightAt(list.pictures, 2);
  const placeholders = list.pictures.filter((picture) => picture.placeholder).length;
  return (
    <>
      <p className="ui-label showcase__lead">
        {list.pictures.length} pictures, {placeholders} of them still placeholders, {megabytes(weight)} at 2x{' '}
        {weight > UI_BUDGET ? <strong className="showcase__over">over</strong> : 'of'} a{' '}
        {megabytes(UI_BUDGET)} budget; cut {new Date(list.cutAt).toLocaleTimeString()}. Every picture is
        painted at {PAINTED_AT} times the size it is shown, and saving over one in <code>world/ui/</code> puts
        it here a moment later.
      </p>
      {UI_KINDS.map((kind) => {
        const pictures = list.pictures.filter((picture) => picture.kind === kind);
        return (
          <Part key={kind} title={KINDS[kind].title}>
            <p className="ui-label showcase__lead">{KINDS[kind].says}</p>
            {pictures.length === 0 ? (
              <p className="showcase__to-come">None yet, in world/ui/{kind}/.</p>
            ) : (
              <Specimens>
                {pictures.map((picture) => (
                  <PictureOnShow key={picture.name} picture={picture} />
                ))}
              </Specimens>
            )}
          </Part>
        );
      })}
    </>
  );
}

function PictureOnShow({ picture }: { picture: UiPicture }) {
  const { src, srcSet } = sourcesOf(picture);
  const lines = [
    `shown ${picture.width}×${picture.height}, painted ${picture.painted.width}×${picture.painted.height}`,
    picture.cuts.map((cut) => `${cut.density}x ${kilobytes(cut.bytes)}`).join(' · '),
  ];
  if (picture.border !== undefined) {
    lines.push(`cut ${picture.border.slice.join(' ')} as shown, ${picture.border.repeat.join(' and ')}`);
  }
  lines.push(
    picture.placeholder ? `placeholder: ${picture.about ?? 'the agent’s'}` : `Adam’s, ${picture.how}`,
  );
  lines.push(`world/ui/${picture.source}`);
  return (
    <Specimen name={picture.name} note={lines}>
      <img
        className={`showcase__picture${picture.placeholder ? ' showcase__picture--placeholder' : ''}`}
        src={src}
        srcSet={srcSet}
        width={picture.width}
        height={picture.height}
        alt=""
      />
    </Specimen>
  );
}
