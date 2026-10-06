import type * as maplibregl from 'maplibre-gl';
import type { WorldName } from '@villages/world';

import { note } from '../log/log';
import { placeLabels } from './infoLabels';
import type { LabelCandidate } from './infoLabels';
import { displayName, loadWorldNames } from './worldNames';
import type { NamedRegion, WorldNames } from './worldNames';

/**
 * The Info map: every name the world has gathered, written over the quietened terrain as an atlas would write
 * it. A picture of the data in `names.json` and `regions.bin` rather than a look: towns of 1790 in black beside
 * their dots, rivers and lakes in blue italic, peaks with their height, seas in spaced italic and named lands in
 * spaced capitals, the important first and more as the camera comes in. See `docs/plans/real-world-names.md`.
 *
 * The rivers and lake shores are MapLibre lines, because there are a hundred and forty thousand points of them.
 * The words are written on a canvas laid over the map and redrawn every frame, because the map's own style has
 * no font to write with; each is placed where MapLibre projects its point, so the camera's tilt is honoured.
 */

const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const INK = '#1d1a16';
const WATER = '#24558f';
const STONE = '#6b4423';
const EARTH = '#7a5230';
const HALO = 'rgba(250, 247, 240, 0.9)';
/** A name is written from half a zoom before its source says it is worth naming. */
const LEAD = 0.5;
/** A continent's or a great area's name is written only while the whole of it fits on the screen. */
const BROAD = ['Continent', 'Geoarea', 'Dragons-be-here'];
const BROAD_UNTIL = 4;

type Kind = WorldName['kind'] | NamedRegion['kind'];

interface Style {
  readonly font: string;
  readonly colour: string;
  readonly spacing: number;
  readonly anchor: LabelCandidate['anchor'];
  /** Placed before kinds with a larger number, among names of the same rank. */
  readonly order: number;
}

function styleOf(kind: Kind, rank: number): Style {
  const big = rank <= 2;
  switch (kind) {
    case 'town':
      return {
        font: `${big ? '600 13px' : rank <= 5 ? '12px' : '11px'} ${SERIF}`,
        colour: INK,
        spacing: 0,
        anchor: 'beside',
        order: 1,
      };
    case 'sea':
      return {
        font: `italic ${big ? 16 : 13}px ${SERIF}`,
        colour: WATER,
        spacing: big ? 3 : 1.5,
        anchor: 'centre',
        order: 0,
      };
    case 'land':
      return {
        font: `${big ? 12 : 10}px ${SERIF}`,
        colour: EARTH,
        spacing: big ? 4 : 2,
        anchor: 'centre',
        order: 2,
      };
    case 'river':
      return { font: `italic 11px ${SERIF}`, colour: WATER, spacing: 0.5, anchor: 'centre', order: 3 };
    case 'lake':
      return { font: `italic 11px ${SERIF}`, colour: WATER, spacing: 0.5, anchor: 'centre', order: 4 };
    case 'peak':
      return { font: `10px ${SERIF}`, colour: STONE, spacing: 0, anchor: 'beside', order: 5 };
  }
}

interface Written extends LabelCandidate {
  readonly text: string;
  readonly kind: Kind;
  readonly style: Style;
  /** Radians, for a river's name laid along it. */
  readonly angle: number;
}

/** Shows the Info map for a master once its names have loaded, until the returned function is called. */
export function watchInfoMap(map: maplibregl.Map, master: string): () => void {
  let stopped = false;
  let hide = (): void => undefined;
  void loadWorldNames(master).then((world) => {
    if (stopped) return;
    if (world === null || world.names === null) {
      note('names', `${master} has no names yet: npm run world:origin --prefix frontend -- ${master}`);
      return;
    }
    hide = showInfoMap(map, world);
    note(
      'names',
      `the Info map writes from ${world.names.length} names and ${world.regions?.list.length ?? 0} seas and lands, ` +
        'the important first and more as the camera comes in',
    );
  });
  return () => {
    stopped = true;
    hide();
  };
}

/** Shows the Info map over a map until the returned function is called. */
export function showInfoMap(map: maplibregl.Map, world: WorldNames): () => void {
  const names = world.names ?? [];
  addLines(map, names);
  const canvas = document.createElement('canvas');
  canvas.className = 'info-map';
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    width: '100%',
    height: '100%',
  });
  map.getContainer().appendChild(canvas);
  const context = canvas.getContext('2d')!;
  const widths = new Map<string, number>();
  // Where along each river its name may be written, worked out once.
  const along = new Map(names.filter((one) => one.kind === 'river').map((one) => [one.id, anchorsOf(one)]));
  const regions = (world.regions?.list ?? []).filter((one) => one.at !== undefined);

  const draw = () => {
    const container = map.getContainer();
    const width = container.clientWidth;
    const height = container.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    const measure = (text: string, style: Style) => {
      const key = `${style.font}|${style.spacing}|${text}`;
      let found = widths.get(key);
      if (found === undefined) {
        context.font = style.font;
        context.letterSpacing = `${style.spacing}px`;
        found = context.measureText(text).width;
        widths.set(key, found);
      }
      return found;
    };
    const candidates: Written[] = [];
    // A river's name is written every so many anchors along it, as many as leaves a gap this wide between.
    const stride = Math.max(1, Math.round(RIVER_GAP / ((STEP * 512 * 2 ** zoom) / 360)));
    const offer = (text: string, kind: Kind, rank: number, at: readonly [number, number], angle = 0) => {
      if (!bounds.contains(at as [number, number])) return;
      const point = map.project(at as [number, number]);
      const style = styleOf(kind, rank);
      const long = measure(text, style);
      const tall = parseFloat(/(\d+)px/.exec(style.font)![1]!) + 2;
      // A name laid at a slant takes up the box round it, not its own length.
      const [w, h] = [
        Math.abs(long * Math.cos(angle)) + Math.abs(tall * Math.sin(angle)),
        Math.abs(long * Math.sin(angle)) + Math.abs(tall * Math.cos(angle)),
      ];
      candidates.push({
        x: point.x,
        y: point.y,
        width: w,
        height: h,
        priority: rank * 10 + style.order,
        anchor: style.anchor,
        text,
        kind,
        style,
        angle,
        key: text,
      });
    };
    for (const one of names) {
      if ((one.from ?? 0) > zoom + LEAD) continue;
      const text =
        one.kind === 'peak' && one.elevation !== undefined
          ? `${one.name} ${one.elevation.toLocaleString('en-GB')}`
          : one.name;
      if (one.kind !== 'river') {
        offer(text, one.kind, one.rank ?? 10, one.at);
        continue;
      }
      const anchors = along.get(one.id) ?? [];
      const chosen = anchors.filter((_, index) => index % stride === Math.floor(stride / 2));
      for (const anchor of chosen.length > 0
        ? chosen
        : anchors.slice(anchors.length >> 1, (anchors.length >> 1) + 1)) {
        offer(text, 'river', one.rank ?? 10, anchor.at, slant(map, anchor.stretch));
      }
    }
    for (const one of regions) {
      if ((one.from ?? 0) > zoom + LEAD || (BROAD.includes(one.feature) && zoom > BROAD_UNTIL)) continue;
      const text = one.kind === 'land' ? displayName(one).toUpperCase() : displayName(one);
      offer(text, one.kind, one.rank ?? 10, one.at!);
    }
    for (const label of placeLabels(candidates, { width, height }, SAID_APART)) write(context, label);
  };

  map.on('render', draw);
  map.triggerRepaint();
  return () => {
    map.off('render', draw);
    canvas.remove();
    removeLines(map);
  };
}

/** One name written, with what marks its place: a dot for a town, a triangle for a peak. */
function write(context: CanvasRenderingContext2D, label: Written): void {
  const { x, y, style, text, kind, angle } = label;
  if (kind === 'town' || kind === 'peak') {
    context.beginPath();
    if (kind === 'town') context.arc(x, y, label.priority < 30 ? 3.5 : 2.5, 0, 2 * Math.PI);
    else {
      context.moveTo(x, y - 4);
      context.lineTo(x + 4, y + 3);
      context.lineTo(x - 4, y + 3);
      context.closePath();
    }
    context.fillStyle = style.colour;
    context.strokeStyle = HALO;
    context.lineWidth = 1.5;
    context.fill();
    context.stroke();
  }
  context.save();
  context.translate(label.anchor === 'beside' ? x + 6 : x, y);
  context.rotate(angle);
  context.font = style.font;
  context.letterSpacing = `${style.spacing}px`;
  context.textAlign = label.anchor === 'beside' ? 'left' : 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineWidth = 3;
  context.strokeStyle = HALO;
  context.strokeText(text, 0, 0);
  context.fillStyle = style.colour;
  context.fillText(text, 0, 0);
  context.restore();
}

/** A place along a river its name may be written, and the stretch of the river it lies on. */
interface Anchor {
  readonly at: readonly [number, number];
  readonly stretch: readonly [readonly [number, number], readonly [number, number]];
}

/** Degrees along a river between one place its name may go and the next. */
const STEP = 0.25;
/** Screen pixels between a river's name and its next along it. */
const RIVER_GAP = 220;
/** Screen pixels within which the same words are not written twice. */
const SAID_APART = 150;

/** Places every `STEP` degrees along each run of a river, the first half a step in. */
function anchorsOf(river: WorldName): Anchor[] {
  const anchors: Anchor[] = [];
  for (const line of river.lines) {
    let walked = STEP / 2;
    for (let at = 1; at < line.length; at += 1) {
      const [a, b] = [line[at - 1]!, line[at]!];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      while (walked <= length) {
        const t = walked / length;
        anchors.push({ at: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], stretch: [a, b] });
        walked += STEP;
      }
      walked -= length;
    }
  }
  return anchors;
}

/** The slant of a stretch of river on the screen, kept the right way up. */
function slant(map: maplibregl.Map, stretch: Anchor['stretch']): number {
  const a = map.project(stretch[0] as [number, number]);
  const b = map.project(stretch[1] as [number, number]);
  let angle = Math.atan2(b.y - a.y, b.x - a.x);
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;
  return angle;
}

const LINES = [
  { id: 'info-rivers', kind: 'river', width: [2, 0.6, 6, 1.4, 9, 2.4] },
  { id: 'info-lakes', kind: 'lake', width: [2, 0.5, 6, 1, 9, 1.6] },
] as const;

function addLines(map: maplibregl.Map, names: readonly WorldName[]): void {
  removeLines(map);
  for (const { id, kind, width } of LINES) {
    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: names
          .filter((one) => one.kind === kind)
          .map((one) => ({
            type: 'Feature' as const,
            properties: { name: one.name },
            geometry: {
              type: 'MultiLineString' as const,
              coordinates: one.lines.map((line) => line.map(([lng, lat]) => [lng, lat])),
            },
          })),
      },
    });
    map.addLayer({
      id,
      type: 'line',
      source: id,
      paint: {
        'line-color': WATER,
        'line-opacity': 0.85,
        'line-width': ['interpolate', ['linear'], ['zoom'], ...width],
      },
    });
  }
}

function removeLines(map: maplibregl.Map): void {
  for (const { id } of LINES) {
    if (map.getLayer(id) !== undefined) map.removeLayer(id);
    if (map.getSource(id) !== undefined) map.removeSource(id);
  }
}
