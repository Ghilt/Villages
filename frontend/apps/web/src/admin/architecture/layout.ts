import dagre from '@dagrejs/dagre';

import { SHELF_CARD, bakedGraph, inShelf, runningGraph } from './graph';
import type { Arrow, Card } from './graph';
import { TOOLS, artifact, piece } from './world';

/** Where a card stands, its top-left corner, and how big it is: inside its group's box when it has one. */
export interface Placed {
  readonly card: Card;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly parent?: string;
  /** Where in its box a box's words stand, from its top left corner: the world cache's leaves them room. */
  readonly words?: { readonly x: number; readonly y: number; readonly width: number };
}

export type Side = 'top' | 'bottom' | 'left' | 'right';

/** An arrow and the sides of its two cards it leaves and arrives at. */
export type Drawn = Arrow & { readonly fromSide?: Side; readonly toSide?: Side };

/** A line across the whole diagram: between what is baked and what runs, or under what the world is made from. */
export interface Line {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/** A file the world is made from: written by Adam or downloaded, and never by a tool of the world. */
export const isSource = (card: Card): boolean =>
  card.kind === 'file' && artifact(card.ref).origin !== 'baked';

/** A tool that makes nothing but sources, the download: it stands above them rather than among the rest. */
export const makesSources = (card: Card): boolean =>
  card.kind === 'tool' &&
  TOOLS.find((tool) => tool.script === card.ref)!.writes.every((id) => artifact(id).origin !== 'baked');

const FILE = { width: 196, height: 120 };
const TOOL = { width: 196, height: 124 };
/** How much taller a card is that says at its foot what an agent does with it. */
const FOOT = 34;
const GAP = 40;
/** The world cache's box: room round the cards inside it, and a place inside it for what it says. */
const SHELF = { pad: 12, words: { width: 600, height: 130 } };
const SHELF_WORDS = `${SHELF_CARD}:words`;

/** A running piece, and the room around it: columns and rows inside a group's box, and the boxes apart. */
const PIECE = { width: 270, height: 226 };
const COLUMN = PIECE.width + 120;
const ROW = PIECE.height + 100;
const PAD = 30;
const HEADER = 100;
const BETWEEN = 120;

/**
 * Where each running piece stands in its group's box, by column and row. In the page, a row of the parts that
 * read baked files, in the order of where what each reads stands above, on average, and under them the
 * connection, which talks down to the gateway and up to the parts drawing what it is told, the fog beside it. In
 * the game server and the event store, a column of three and a row of two: the gateway is above what feeds it,
 * Occurrent above what keeps its events, the bridge beside it and above the broker it publishes to, and the feed
 * runs up.
 */
const SPOTS: Record<string, { readonly col: number; readonly row: number }> = {
  painter: { col: 0, row: 0 },
  grass: { col: 1, row: 0 },
  water: { col: 2, row: 0 },
  map: { col: 3, row: 0 },
  pictures: { col: 4, row: 0 },
  sprites: { col: 5, row: 0 },
  panes: { col: 6, row: 0 },
  relief: { col: 7, row: 0 },
  fog: { col: 4.5, row: 1 },
  connection: { col: 5.5, row: 1 },
  gateway: { col: 1, row: 0 },
  rules: { col: 0, row: 1 },
  reactions: { col: 1, row: 1 },
  projections: { col: 2, row: 1 },
  occurrent: { col: 1, row: 0 },
  bridge: { col: 2, row: 0 },
  memory: { col: 0, row: 1 },
  mongodb: { col: 1, row: 1 },
  rabbitmq: { col: 2, row: 1 },
};

/** The groups' boxes, top to bottom beneath the line. */
const GROUP_ORDER = ['group:page', 'group:server', 'group:events'];

/** A group's box: as wide and as tall as the columns and rows its pieces stand in, and room for what it says. */
function boxOf(group: string): { width: number; height: number } {
  const spots = Object.entries(SPOTS)
    .filter(([id]) => `group:${piece(id).group}` === group)
    .map(([, spot]) => spot);
  const [cols, rows] = [Math.max(...spots.map((s) => s.col)), Math.max(...spots.map((s) => s.row))];
  return { width: 2 * PAD + cols * COLUMN + PIECE.width, height: HEADER + rows * ROW + PIECE.height + PAD };
}

/** An arrow that would cut through the cards between its ends goes round the outside instead. */
const ROUND: Record<string, readonly [Side, Side]> = {
  'run:connection>run:gateway': ['bottom', 'top'],
  'run:rabbitmq>run:projections': ['right', 'right'],
  'run:occurrent>run:memory': ['left', 'top'],
};

/**
 * How big a card is drawn, so the layout and the drawing agree: a new object each time, because dagre writes where
 * it put a card into the one it is given.
 */
export function sizeOf(card: Card): { width: number; height: number } {
  switch (card.kind) {
    case 'file': {
      const a = artifact(card.ref);
      return { ...FILE, height: FILE.height + (a.development === undefined ? 0 : FOOT) };
    }
    case 'tool': {
      const tool = TOOLS.find((one) => one.script === card.ref)!;
      return { ...TOOL, height: TOOL.height + (tool.development === undefined ? 0 : FOOT) };
    }
    case 'piece':
      return { ...PIECE };
    case 'group':
      return boxOf(card.id);
    case 'shelf':
      return { width: 0, height: 0 };
  }
}

/**
 * The whole diagram, laid out top to bottom. Along the top, on one row, every file the world is made from - what
 * Adam writes and what is downloaded - with the download above the files it fetches, and a line under the row.
 * Under that, what the tools make of them is laid out by dagre in ranks, so each tool stands below what it reads
 * and above what it writes; each source stands over the tools that read it, so its arrows stay short. The running
 * cards are not part of that: they stand beneath a line drawn under the lowest baked card, so every arrow into them
 * crosses it: each group's box with its pieces in it, the page's first. The master's tools and what they make
 * stand in the world cache's box, which dagre lays out as a cluster: as big as they need, and the rest of the
 * baked cards round it.
 */
export function layOut(): { placed: Placed[]; arrows: Drawn[]; line: Line; sources: Line } {
  const baked = bakedGraph();
  const running = runningGraph();
  const above = (card: Card) => isSource(card) || makesSources(card);
  const made = baked.cards.filter((card) => !above(card));
  const inMade = new Set(made.map((card) => card.id));

  const graph = new dagre.graphlib.Graph({ compound: true });
  // Cards a rank apart by more than the box's padding twice over, so a card beside the box stays clear of it.
  graph.setGraph({
    rankdir: 'TB',
    nodesep: 2 * SHELF.pad + 6,
    edgesep: 4,
    ranksep: 64,
    ranker: 'tight-tree',
  });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const card of made) graph.setNode(card.id, card.kind === 'shelf' ? {} : sizeOf(card));
  for (const card of made) if (inShelf(card)) graph.setParent(card.id, SHELF_CARD);
  // What the box says is a card of its own inside it that nothing points at, so dagre leaves it room among the
  // box's own cards and never puts another card under the words.
  graph.setNode(SHELF_WORDS, SHELF.words);
  graph.setParent(SHELF_WORDS, SHELF_CARD);
  for (const a of baked.arrows) if (inMade.has(a.from) && inMade.has(a.to)) graph.setEdge(a.from, a.to);
  dagre.layout(graph);

  const placed: Placed[] = made.map((card) => {
    const at = graph.node(card.id);
    if (card.kind !== 'shelf') {
      return { card, x: at.x - at.width / 2, y: at.y - at.height / 2, width: at.width, height: at.height };
    }
    const [x, y] = [at.x - at.width / 2 - SHELF.pad, at.y - at.height / 2 - SHELF.pad];
    const words = graph.node(SHELF_WORDS);
    return {
      card,
      x,
      y,
      width: at.width + 2 * SHELF.pad,
      height: at.height + 2 * SHELF.pad,
      words: { x: words.x - words.width / 2 - x, y: words.y - words.height / 2 - y, width: words.width },
    };
  });
  const sources = placeSources(baked.cards, baked.arrows, placed);
  placed.push(...sources.placed);

  const left = Math.min(...placed.map((p) => p.x));
  const right = Math.max(...placed.map((p) => p.x + p.width));
  const bottom = Math.max(...placed.map((p) => p.y + p.height));

  const line: Line = { x: left - GAP, y: bottom + 70, width: right - left + 2 * GAP };

  const middle = (left + right) / 2;
  const boxes = new Map<string, { x: number; y: number; width: number; height: number }>();
  let top = line.y + 110;
  for (const id of GROUP_ORDER) {
    const size = boxOf(id);
    boxes.set(id, { x: middle - size.width / 2, y: top, ...size });
    top += size.height + BETWEEN;
  }
  const at = new Map<string, { x: number; y: number }>();
  for (const card of running.cards) {
    if (card.kind === 'group') {
      placed.push({ card, ...boxes.get(card.id)! });
      continue;
    }
    if (card.kind !== 'piece' || card.group === undefined) continue;
    const spot = SPOTS[card.ref]!;
    const [x, y] = [PAD + spot.col * COLUMN, HEADER + spot.row * ROW];
    const box = boxes.get(card.group)!;
    placed.push({ card, x, y, ...PIECE, parent: card.group });
    at.set(card.id, { x: box.x + x, y: box.y + y });
  }

  const sided = running.arrows.map((a): Drawn => {
    const [from, to] = [at.get(a.from), at.get(a.to)];
    if (a.flow || from === undefined || to === undefined) return a;
    const [fromSide, toSide] = ROUND[a.id] ?? facing(from, to);
    return { ...a, fromSide, toSide };
  });

  return {
    placed,
    arrows: [...baked.arrows, ...sided],
    line,
    sources: { x: left - GAP, y: sources.line, width: right - left + 2 * GAP },
  };
}

/** Room between two sources on their row, and between the rows above and below it. */
const SOURCE_GAP = 26;
const ROW_GAP = 64;
const UNDER_LINE = 80;

/**
 * The sources on their row and the download above it, and where the line under the row goes. Each source stands
 * where the tools reading it are, on average, so its arrows run down rather than across, and what one download
 * fetches stands together under it; one nothing below reads goes to the right end. What dagre laid out is moved
 * down beneath them, in place.
 */
function placeSources(
  cards: readonly Card[],
  arrows: readonly Arrow[],
  made: Placed[],
): { placed: Placed[]; line: number } {
  const centre = new Map(made.map((p) => [p.card.id, p.x + p.width / 2]));
  const sources = cards.filter(isSource);
  const downloads = cards.filter(makesSources);
  const under = (id: string) => {
    const readers = arrows.filter((a) => a.from === id && centre.has(a.to)).map((a) => centre.get(a.to)!);
    return readers.length === 0 ? Infinity : readers.reduce((sum, x) => sum + x, 0) / readers.length;
  };
  // What one download fetches stands together, under it, where its files' readers are on average.
  const fetchedBy = new Map<string, string[]>();
  for (const card of downloads) {
    const fetched = arrows.filter((a) => a.from === card.id).map((a) => a.to);
    for (const id of fetched) fetchedBy.set(id, fetched);
  }
  const mean = (xs: number[]) => {
    const known = xs.filter(Number.isFinite);
    return known.length === 0 ? Infinity : known.reduce((sum, x) => sum + x, 0) / known.length;
  };
  const place = (id: string) => mean((fetchedBy.get(id) ?? [id]).map(under));
  const ordered = [...sources].sort(
    (one, other) => place(one.id) - place(other.id) || under(one.id) - under(other.id),
  );

  const [file, tool] = [FILE, TOOL];
  const width = ordered.length * file.width + (ordered.length - 1) * SOURCE_GAP;
  const middle = (Math.min(...made.map((p) => p.x)) + Math.max(...made.map((p) => p.x + p.width))) / 2;
  const rowY = downloads.length > 0 ? tool.height + ROW_GAP : 0;
  const placed: Placed[] = ordered.map((card, i) => ({
    card,
    x: middle - width / 2 + i * (file.width + SOURCE_GAP),
    y: rowY,
    ...file,
  }));
  const at = new Map(placed.map((p) => [p.card.id, p.x + p.width / 2]));
  for (const card of downloads) {
    const fetched = arrows.filter((a) => a.from === card.id && at.has(a.to)).map((a) => at.get(a.to)!);
    const x = fetched.reduce((sum, one) => sum + one, 0) / Math.max(1, fetched.length);
    placed.push({ card, x: x - tool.width / 2, y: 0, ...tool });
  }

  const line = rowY + file.height + UNDER_LINE / 2;
  const shift = line + UNDER_LINE - Math.min(...made.map((p) => p.y));
  made.forEach((p, i) => (made[i] = { ...p, y: p.y + shift }));
  return { placed, line };
}

/** The sides two pieces face each other by: top and bottom when one is mostly above the other, else left and right. */
function facing(from: { x: number; y: number }, to: { x: number; y: number }): readonly [Side, Side] {
  const [dx, dy] = [to.x - from.x, to.y - from.y];
  if (Math.abs(dy) > Math.abs(dx) * 0.6) return dy > 0 ? ['bottom', 'top'] : ['top', 'bottom'];
  return dx > 0 ? ['right', 'left'] : ['left', 'right'];
}
