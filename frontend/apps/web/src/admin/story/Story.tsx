import '../../ui/ui.css';
import './story.css';

import { useMemo, useState } from 'react';

import { portraitUrl } from '../../figures/portraits';
import { Card } from '../../ui/card/Card';
import { Medallion } from '../../ui/medallion/Medallion';
import { InspectPage } from '../frame/InspectPage';
import { useJson } from '../frame/useJson';
import { parseStory, saidIn, typeset } from './storyDocument';
import type { StoryBox, StoryPart, StoryPicture } from './storyDocument';

/** What the dev server's `/story-document/` sends, as `vite/storyApi.ts` reads it. */
interface StoryFile {
  readonly document: string;
}

/** What the dev server says when `docs/STORY.md` changed on disk: `STORY_CHANGED` in `vite/storyApi.ts`. */
const STORY_CHANGED = 'villages:story-changed';

/** How tall a portrait's oval is drawn, in pixels: alone, and in a row of several. */
const OVAL = 150;
const OVAL_IN_A_ROW = 124;

/**
 * The world's story as a timeline, `docs/STORY.md` drawn: time runs down the page from the first box to the last,
 * which is the present, where the line ends. Each box stands to the right of the line, on the day it is dated with,
 * in the game's own cards - what happened on night, as the library's `card.event` draws something that happened, and
 * lore, what is so, on parchment and set a little apart - and its portraits in ovals under it. An invention is no box:
 * its name and its year stand small to the left of the line, at their place in time, and nothing more. Read through the dev
 * server, and again whenever the document is saved, so a box written is a box seen. Nothing here is changed: the story
 * is written in the document.
 */
export function Story() {
  const file = useJson<StoryFile>('/story-document/', STORY_CHANGED);
  const parsed = useMemo((): StoryPart[] | string => {
    if (file === null || file === 'missing') return [];
    try {
      return parseStory(file.document);
    } catch (unread) {
      return unread instanceof Error ? unread.message : String(unread);
    }
  }, [file]);
  const parts = typeof parsed === 'string' ? [] : parsed;
  const all = parts.flatMap((part) => part.boxes);
  const inventions = all.filter((box) => box.kind === 'invention').length;
  const last = parts.at(-1)?.boxes.at(-1);

  return (
    <InspectPage
      title="Story"
      epigraph="The world's history, from the first light of reason to the day the houses begin"
      bar={
        <span className="inspect-note">
          {all.length - inventions} boxes and {inventions} inventions from docs/STORY.md
        </span>
      }
    >
      {file === 'missing' && (
        <p className="inspect-problem">
          docs/STORY.md could not be had: this page reads it through the dev server
        </p>
      )}
      {typeof parsed === 'string' && <p className="inspect-problem">docs/STORY.md, {parsed}</p>}
      <div className="story ui-root ui-on-parchment">
        {parts.map((part) => (
          <section key={part.name} className="story-part" aria-label={part.name}>
            <header className="story-part__head">
              <h2 className="ui-title story-part__name">{typeset(part.name)}</h2>
              {part.opening.map((said, at) => (
                <p key={at} className="ui-epigraph story-part__opening">
                  <Words text={said} />
                </p>
              ))}
            </header>
            <ol className="story-line">
              {part.boxes.map((box, at) => (
                <Entry key={`${at}-${box.name}`} box={box} now={box === last} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </InspectPage>
  );
}

/** One box on the line: its day to the left, its mark on the line, and its card and portraits to the right. */
function Entry({ box, now }: { box: StoryBox; now: boolean }) {
  if (box.kind === 'invention') return <Invention box={box} />;
  const lore = box.kind === 'lore';
  const kind = lore ? 'lore' : box.when === null ? 'undated' : 'dated';
  return (
    <li className={`story-entry story-entry--${kind}${now ? ' story-entry--now' : ''}`}>
      <div className="story-entry__when">{box.when}</div>
      <div className="story-entry__rail" aria-hidden>
        {now ? <Medallion name="compass" size={44} /> : <span className="story-entry__mark" />}
      </div>
      <div className="story-entry__body">
        {box.words.length > 0 && (
          <Card
            recipe={lore ? 'card.figure' : 'card.event'}
            title={typeset(box.name)}
            {...(lore ? { line: 'Lore' } : {})}
          >
            {box.words.map((said, at) => (
              <p key={at} className="ui-body story-entry__words">
                <Words text={said} />
              </p>
            ))}
          </Card>
        )}
        {box.pictures.map((row, at) => (
          <div key={at} className="story-pictures">
            {row.map((picture) => (
              <Portrait key={picture.key} picture={picture} size={row.length > 2 ? OVAL_IN_A_ROW : OVAL} />
            ))}
          </div>
        ))}
      </div>
    </li>
  );
}

/** An invention: its name and its real year to the left of the line, a tick on it, and nothing to the right. */
function Invention({ box }: { box: StoryBox }) {
  return (
    <li className="story-entry story-entry--invention">
      <div className="story-entry__when">
        <span className="story-invention__name">{typeset(box.name)}</span>{' '}
        <span className="story-invention__year">{box.when}</span>
      </div>
      <div className="story-entry__rail" aria-hidden>
        <span className="story-entry__mark" />
      </div>
      <div className="story-entry__body" />
    </li>
  );
}

/** A portrait in its oval, with its words under it; one whose file is not there says so in the oval's place. */
function Portrait({ picture, size }: { picture: StoryPicture; size: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const missing = failed === picture.key;
  return (
    <figure className="story-portrait">
      {missing ? (
        <span className="story-portrait__missing" style={{ height: size }}>
          not in world/portraits/: {picture.key}.png
        </span>
      ) : (
        <Medallion
          name="portrait-oval"
          size={size}
          label={typeset(picture.caption)}
          picture={
            <img
              src={portraitUrl(picture.key)}
              alt=""
              draggable={false}
              onError={() => setFailed(picture.key)}
            />
          }
        />
      )}
      <figcaption className="ui-label story-portrait__caption">{typeset(picture.caption)}</figcaption>
    </figure>
  );
}

/** A paragraph, its italics as `*a word*` marks them. */
function Words({ text }: { text: string }) {
  return (
    <>{saidIn(typeset(text)).map((run, at) => (run.italic ? <em key={at}>{run.text}</em> : run.text))}</>
  );
}
