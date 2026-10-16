/*
 * The story as its inspect page reads it: `docs/STORY.md`, by the rules its "How it is kept" sets out. A `##` with
 * boxes under it is a part, a `###` is a box, `when · name`, a `####` an invention, `year · name` and nothing more, a
 * paragraph is a box's words, and a paragraph of nothing but portraits is a row of them. Whatever the rules cannot read is said, line and all, rather than skipped, so a box
 * that does not show is never a mystery.
 */

/** A picture standing in the story: a portrait by its key, with the words said under it. */
export interface StoryPicture {
  readonly key: string;
  readonly caption: string;
}

/**
 * What a box is: something that happened; lore, something that is so, a box whose when is `Lore`; or an invention,
 * a `####` heading, its real year and its name and nothing more.
 */
export type StoryKind = 'event' | 'lore' | 'invention';

/** One box of the story, as its heading and the paragraphs under it say it. */
export interface StoryBox {
  readonly kind: StoryKind;
  /** When it happened, as it is written - `1785`, `1785–1790`, `1 January 1790` - or null for a box at no one time. */
  readonly when: string | null;
  readonly name: string;
  /** Its paragraphs, each joined into one line. */
  readonly words: readonly string[];
  /** Its rows of pictures, in order. */
  readonly pictures: readonly (readonly StoryPicture[])[];
}

/** A part of the story: its name, what is said before its first box, and its boxes. */
export interface StoryPart {
  readonly name: string;
  readonly opening: readonly string[];
  readonly boxes: readonly StoryBox[];
}

/** Where a box's when and its name part: `### 1785 · The ritual`, the first middle dot, spaced or not. */
const SPLIT = '·';

/** A picture as a paragraph names it: `![words](../world/portraits/<key>.png)`. */
const PICTURE = /!\[([^\]]*)\]\(([^)]*)\)/g;
const PORTRAIT = /^\.\.\/world\/portraits\/([a-z0-9]+(?:-[a-z0-9]+)*)\.png$/;

interface Building {
  name: string;
  opening: string[];
  boxes: {
    kind: StoryKind;
    when: string | null;
    name: string;
    words: string[];
    pictures: StoryPicture[][];
  }[];
}

/** The parts of the story that have boxes, in the document's order. Throws, saying the line, at what it cannot read. */
export function parseStory(document: string): StoryPart[] {
  const parts: Building[] = [];
  let paragraph: { text: string; line: number } | null = null;

  const said = () => {
    if (paragraph === null) return;
    const { text, line } = paragraph;
    paragraph = null;
    const part = parts.at(-1);
    if (part === undefined) return;
    const box = part.boxes.at(-1);
    // Before a box it is an opening, or words about the document in a heading that has no boxes, and read as words.
    if (box === undefined) {
      part.opening.push(text);
      return;
    }
    if (box.kind === 'invention') {
      throw new Error(`line ${line}: an invention is its year and its name, and nothing under them`);
    }
    const row = picturesIn(text, line);
    if (row === null) {
      box.words.push(text);
    } else {
      box.pictures.push(row);
    }
  };

  document.split(/\r?\n/).forEach((written, at) => {
    const line = at + 1;
    const text = written.trim();
    if (text.startsWith('#')) {
      said();
      if (text.startsWith('## ')) parts.push({ name: text.slice(3).trim(), opening: [], boxes: [] });
      if (text.startsWith('### ') || text.startsWith('#### ')) {
        const part = parts.at(-1);
        if (part === undefined) throw new Error(`line ${line}: a box stands before any part`);
        const invention = text.startsWith('#### ');
        const heading = headingOf(text.slice(invention ? 5 : 4).trim(), line);
        if (invention && (heading.when === null || heading.kind === 'lore')) {
          throw new Error(`line ${line}: an invention wants its year: "#### 1440 · The printing press"`);
        }
        part.boxes.push({ ...heading, ...(invention ? { kind: 'invention' } : {}), words: [], pictures: [] });
      }
      return;
    }
    if (text === '') {
      said();
      return;
    }
    paragraph =
      paragraph === null ? { text, line } : { text: `${paragraph.text} ${text}`, line: paragraph.line };
  });
  said();

  return parts.filter((part) => part.boxes.length > 0);
}

function headingOf(heading: string, line: number): { kind: StoryKind; when: string | null; name: string } {
  const split = heading.indexOf(SPLIT);
  if (split === -1) return { kind: 'event', when: null, name: heading };
  const when = heading.slice(0, split).trim();
  const name = heading.slice(split + SPLIT.length).trim();
  // A dot with nothing before it or after it is a half-written heading, not a box at no one time.
  if (when === '' || name === '')
    throw new Error(`line ${line}: "${heading}" wants a when and a name either side of " · "`);
  return when === 'Lore' ? { kind: 'lore', when: null, name } : { kind: 'event', when, name };
}

/** The row of pictures a paragraph is, or null when it is words: a paragraph of words with a picture in it is said. */
function picturesIn(text: string, line: number): StoryPicture[] | null {
  const found = [...text.matchAll(PICTURE)];
  if (found.length === 0) return null;
  if (text.replace(PICTURE, '').trim() !== '') {
    throw new Error(`line ${line}: a picture stands among words; give it a paragraph of its own`);
  }
  return found.map(([, caption, path]) => {
    const portrait = PORTRAIT.exec(path!);
    if (portrait === null) {
      throw new Error(
        `line ${line}: ${path} is not a portrait, ../world/portraits/<key>.png, which is all the story shows yet`,
      );
    }
    return { key: portrait[1]!, caption: caption!.trim() };
  });
}

/** A run of words, and whether it is said in italics: `*a word*` is. */
export interface Said {
  readonly text: string;
  readonly italic: boolean;
}

/** A paragraph's words in runs, the italic ones as `*a word*` marks them. */
export function saidIn(text: string): Said[] {
  return text
    .split(/(\*[^*]+\*)/)
    .filter((run) => run !== '')
    .map((run) =>
      run.length > 2 && run.startsWith('*') && run.endsWith('*')
        ? { text: run.slice(1, -1), italic: true }
        : { text: run, italic: false },
    );
}

/** The document's plain marks as the page sets them: a spaced hyphen is a dash, and an apostrophe is curled. */
export function typeset(text: string): string {
  return text.replaceAll(' - ', ' – ').replaceAll("'", '’');
}

/** Every portrait the story names, once each, in the order it first names them. */
export function portraitsIn(parts: readonly StoryPart[]): string[] {
  const keys = parts.flatMap((part) =>
    part.boxes.flatMap((box) => box.pictures.flat().map((picture) => picture.key)),
  );
  return [...new Set(keys)];
}
