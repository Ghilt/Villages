/**
 * The die on the ground, worked out whole the moment it is let go: one cube, gravity, a bounce and friction against the
 * ground and against whatever stands on it, and a tumble, stepped until it lies still. Its flight from the hand to the
 * ground is `flight.ts`'s, an arc scaled to the throw; this is what it does once it strikes, at the ground's own scale. Nothing here draws or reads the
 * map. Lengths are in die widths, so the die is one wide whatever size it is drawn at, and the axes are east, south
 * and up, as the camera's arithmetic has them.
 *
 * Worked out ahead rather than stepped frame by frame, so that the page knows where the die will rest and which face
 * will come up before it has moved: where it rests is the roll's landing, and the face is painted with the number the
 * game wants. The contacts are a cube's eight corners, solved with impulses accumulated over several passes and held
 * inside friction's cone, which is what lets a die settle rather than rock for ever. See
 * `docs/plans/choice-roll-podium.md`, *The physics*.
 */

/** A point or a direction in the die's world: east, south and up, in die widths. */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A turn of the die, as a unit quaternion. */
export interface Quat {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

/** How the die moves: the numbers the spike page puts on sliders. */
export interface DieFeel {
  /** How fast it falls faster, in die widths a second, every second. */
  readonly gravity: number;
  /** How much of its speed into the ground a bounce gives back, from nought to one. */
  readonly bounce: number;
  /** How hard the ground holds it as it slides. */
  readonly friction: number;
  /** How much of its spin it keeps every 240th of a second it touches the ground. */
  readonly rolling: number;
  /**
   * How much of its speed along the ground it keeps every 240th of a second it touches it: the grass holding it. A strike
   * touches for an instant and keeps nearly all of it, so the die still bounces on the way it flew; a die sliding on a
   * face touches all the time, and stops. Friction alone did both, and a friction that stopped a slide kicked a hard
   * strike on a corner any way at all.
   */
  readonly sliding: number;
  /** How hard a throw spins it, for every die width a second it is thrown. */
  readonly spin: number;
}

export const FEEL: DieFeel = {
  gravity: 200,
  bounce: 0.6,
  friction: 0.1,
  rolling: 0.985,
  sliding: 0.975,
  spin: 1,
};

/** Something standing on the ground the die can strike, in die widths from where it was let go. */
export type Obstacle =
  | {
      readonly kind: 'post';
      readonly x: number;
      readonly y: number;
      readonly radius: number;
      readonly height: number;
    }
  | {
      readonly kind: 'box';
      readonly west: number;
      readonly east: number;
      readonly north: number;
      readonly south: number;
      readonly height: number;
    };

/** Where the die is at a moment: its middle, and its turn. */
export interface DieState {
  readonly at: Vec3;
  readonly turn: Quat;
}

/** Where it struck the ground or something on it, how hard, and when: what the juice is played from. */
export interface Knock {
  readonly time: number;
  readonly at: Vec3;
  readonly speed: number;
}

/** A throw worked out: where the die is every frame, what it struck, and how it ended. */
export interface ThrowPath {
  /** Seconds between two frames. */
  readonly every: number;
  readonly frames: readonly DieState[];
  readonly knocks: readonly Knock[];
  /** The face lying on top at the end, by its index in `FACES`. */
  readonly up: number;
  /** Whether it came to rest by itself, rather than being laid on a face when time ran out. */
  readonly settled: boolean;
  /** How many steps it took to work out. */
  readonly steps: number;
}

/** How the die starts: where its middle is, how fast it moves and spins, and how it is turned. */
export interface Start {
  readonly at: Vec3;
  readonly velocity: Vec3;
  readonly spin: Vec3;
  readonly turn: Quat;
}

/** The die's six faces, by the direction each faces before it is turned: east, west, south, north, up and down. */
export const FACES: readonly Vec3[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

export const STILL: Quat = { x: 0, y: 0, z: 0, w: 1 };

/** Steps a second: stable from 60 up, and a throw is a few hundred of them, a millisecond or two in all. */
const RATE = 240;
/** A frame kept every this many steps, which the page plays back between. */
const KEEP_EVERY = 2;
/** How far into the ground a corner may be and still count as resting on it, so a flat die lies on all four. */
const SLOP = 0.06;
/** Slower than this into the ground and a contact does not bounce at all, so a die at rest stays at rest. */
const BOUNCES_FROM = 2;
/** Struck harder than this, a knock is kept for the juice. */
const KNOCKS_FROM = 6;
/** How long it must be slow before it is asleep, and the longest a throw may take before it is laid on a face. */
const SLEEPS_AFTER = 0.25;
const LONGEST = 4;
const PASSES = 10;
/** A cube one wide weighing one: its inertia is the same about every axis, a sixth. */
const INV_MASS = 1;
const INV_INERTIA = 6;
const HALF = 0.5;

const CORNERS: readonly Vec3[] = [-HALF, HALF].flatMap((x) =>
  [-HALF, HALF].flatMap((y) => [-HALF, HALF].map((z) => ({ x, y, z }))),
);

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
export function scale(a: Vec3, by: number): Vec3 {
  return { x: a.x * by, y: a.y * by, z: a.z * by };
}
export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
export function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

export function multiply(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export function normalised(q: Quat): Quat {
  const size = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  return { x: q.x / size, y: q.y / size, z: q.z / size, w: q.w / size };
}

/** A direction on the die turned as the die is. */
export function rotate(q: Quat, v: Vec3): Vec3 {
  const t = scale(cross(q, v), 2);
  return add(add(v, scale(t, q.w)), cross(q, t));
}

/** The turn about an axis, by an angle in radians. */
export function about(axis: Vec3, angle: number): Quat {
  const unit = scale(axis, 1 / length(axis));
  const s = Math.sin(angle / 2);
  return { x: unit.x * s, y: unit.y * s, z: unit.z * s, w: Math.cos(angle / 2) };
}

/** The face lying most nearly on top, by its index in `FACES`. */
export function faceUp(turn: Quat): number {
  let best = 0;
  let highest = -2;
  FACES.forEach((face, index) => {
    const up = rotate(turn, face).z;
    if (up > highest) {
      highest = up;
      best = index;
    }
  });
  return best;
}

/** The turn laid exactly flat on the face nearest the top, keeping which way the die faces. */
export function laidFlat(turn: Quat): Quat {
  const face = rotate(turn, FACES[faceUp(turn)]!);
  const axis = cross(face, { x: 0, y: 0, z: 1 });
  const size = length(axis);
  if (size < 1e-9) return turn;
  return normalised(multiply(about(axis, Math.atan2(size, face.z)), turn));
}

interface Contact {
  readonly r: Vec3;
  readonly normal: Vec3;
  readonly tangents: readonly [Vec3, Vec3];
  readonly target: number;
  readonly depth: number;
  normalImpulse: number;
  readonly tangentImpulses: [number, number];
}

interface Body {
  p: Vec3;
  v: Vec3;
  w: Vec3;
  q: Quat;
}

function tangentsOf(normal: Vec3): [Vec3, Vec3] {
  const across = Math.abs(normal.z) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
  const first = cross(normal, across);
  const unit = scale(first, 1 / length(first));
  return [unit, cross(normal, unit)];
}

function velocityAt(body: Body, r: Vec3): Vec3 {
  return add(body.v, cross(body.w, r));
}

function push(body: Body, r: Vec3, impulse: Vec3): void {
  body.v = add(body.v, scale(impulse, INV_MASS));
  body.w = add(body.w, scale(cross(r, impulse), INV_INERTIA));
}

function stiffness(r: Vec3, direction: Vec3): number {
  const turning = cross(r, direction);
  return INV_MASS + INV_INERTIA * dot(turning, turning);
}

function contact(body: Body, r: Vec3, normal: Vec3, depth: number): Contact {
  const into = dot(velocityAt(body, r), normal);
  return {
    r,
    normal,
    tangents: tangentsOf(normal),
    target: into < -BOUNCES_FROM ? -into : 0,
    depth,
    normalImpulse: 0,
    tangentImpulses: [0, 0],
  };
}

/** Where a corner meets what it is inside of, if anything: the way out, and how far in it is. */
function struck(point: Vec3, obstacle: Obstacle): { normal: Vec3; depth: number } | null {
  if (point.z > obstacle.height + SLOP) return null;
  const top = obstacle.height - point.z;
  if (obstacle.kind === 'post') {
    const east = point.x - obstacle.x;
    const south = point.y - obstacle.y;
    const out = Math.hypot(east, south);
    if (out >= obstacle.radius) return null;
    const side = obstacle.radius - out;
    if (top <= side || out < 1e-9) return { normal: { x: 0, y: 0, z: 1 }, depth: top };
    return { normal: { x: east / out, y: south / out, z: 0 }, depth: side };
  }
  const ways: readonly [Vec3, number][] = [
    [{ x: 0, y: 0, z: 1 }, top],
    [{ x: -1, y: 0, z: 0 }, point.x - obstacle.west],
    [{ x: 1, y: 0, z: 0 }, obstacle.east - point.x],
    [{ x: 0, y: -1, z: 0 }, point.y - obstacle.north],
    [{ x: 0, y: 1, z: 0 }, obstacle.south - point.y],
  ];
  if (ways.some(([, depth]) => depth <= -SLOP)) return null;
  const [normal, depth] = ways.reduce((least, way) => (way[1] < least[1] ? way : least));
  return { normal, depth };
}

/** Everything the die touches this step, the ground and what stands on it. */
function contactsOf(body: Body, obstacles: readonly Obstacle[]): Contact[] {
  const found: Contact[] = [];
  for (const corner of CORNERS) {
    const r = rotate(body.q, corner);
    const point = add(body.p, r);
    if (point.z <= SLOP) found.push(contact(body, r, { x: 0, y: 0, z: 1 }, -point.z));
    for (const obstacle of obstacles) {
      const hit = struck(point, obstacle);
      if (hit !== null) found.push(contact(body, r, hit.normal, hit.depth));
    }
  }
  // A post thinner than the die slips between its corners, so the die's own round middle strikes one too.
  for (const obstacle of obstacles) {
    if (obstacle.kind !== 'post' || body.p.z - HALF > obstacle.height) continue;
    const east = body.p.x - obstacle.x;
    const south = body.p.y - obstacle.y;
    const apart = Math.hypot(east, south);
    const reach = obstacle.radius + HALF;
    if (apart >= reach || apart < 1e-9) continue;
    const normal = { x: east / apart, y: south / apart, z: 0 };
    found.push(contact(body, scale(normal, -HALF), normal, reach - apart));
  }
  return found;
}

function solve(body: Body, contacts: Contact[], friction: number, bounce: number): void {
  for (let pass = 0; pass < PASSES; pass++) {
    for (const c of contacts) {
      const into = dot(velocityAt(body, c.r), c.normal);
      const wanted = Math.max(c.normalImpulse + (c.target * bounce - into) / stiffness(c.r, c.normal), 0);
      push(body, c.r, scale(c.normal, wanted - c.normalImpulse));
      c.normalImpulse = wanted;
      c.tangents.forEach((tangent, which) => {
        const along = dot(velocityAt(body, c.r), tangent);
        const limit = friction * c.normalImpulse;
        const held = c.tangentImpulses[which]!;
        const next = Math.min(Math.max(held - along / stiffness(c.r, tangent), -limit), limit);
        push(body, c.r, scale(tangent, next - held));
        c.tangentImpulses[which] = next;
      });
    }
  }
}

/** Works the whole throw out, from the moment it is let go until it lies still on a face. */
export function throwDie(start: Start, feel: DieFeel, obstacles: readonly Obstacle[] = []): ThrowPath {
  const dt = 1 / RATE;
  const body: Body = { p: start.at, v: start.velocity, w: start.spin, q: normalised(start.turn) };
  const frames: DieState[] = [{ at: body.p, turn: body.q }];
  const knocks: Knock[] = [];
  let slow = 0;
  let steps = 0;
  let settled = false;
  while (steps * dt < LONGEST) {
    steps += 1;
    body.v = add(body.v, { x: 0, y: 0, z: -feel.gravity * dt });
    const contacts = contactsOf(body, obstacles);
    const hardest = contacts.reduce((most, c) => Math.max(most, c.target), 0);
    if (hardest > KNOCKS_FROM) {
      const first = contacts.find((c) => c.target === hardest)!;
      knocks.push({ time: steps * dt, at: add(body.p, first.r), speed: hardest });
    }
    solve(body, contacts, feel.friction, feel.bounce);
    // Out of whatever it sank into, by most of the way, along each way out.
    const deepest = new Map<string, { normal: Vec3; depth: number }>();
    for (const c of contacts) {
      const key = `${c.normal.x},${c.normal.y},${c.normal.z}`;
      if (c.depth > (deepest.get(key)?.depth ?? 0)) deepest.set(key, { normal: c.normal, depth: c.depth });
    }
    for (const { normal, depth } of deepest.values()) body.p = add(body.p, scale(normal, depth * 0.8));
    body.p = add(body.p, scale(body.v, dt));
    const turning = multiply(
      { x: body.w.x * dt * HALF, y: body.w.y * dt * HALF, z: body.w.z * dt * HALF, w: 0 },
      body.q,
    );
    body.q = normalised({
      x: body.q.x + turning.x,
      y: body.q.y + turning.y,
      z: body.q.z + turning.z,
      w: body.q.w + turning.w,
    });
    if (contacts.length > 0) {
      body.w = scale(body.w, feel.rolling ** (RATE * dt));
      const held = feel.sliding ** (RATE * dt);
      body.v = { x: body.v.x * held, y: body.v.y * held, z: body.v.z };
    }
    slow = length(body.v) < 0.6 && length(body.w) < 0.2 ? slow + dt : 0;
    if (steps % KEEP_EVERY === 0) frames.push({ at: body.p, turn: body.q });
    if (slow > SLEEPS_AFTER) {
      settled = true;
      break;
    }
  }
  const flat = laidFlat(body.q);
  frames.push({ at: { x: body.p.x, y: body.p.y, z: HALF }, turn: flat });
  return { every: KEEP_EVERY * dt, frames, knocks, up: faceUp(flat), settled, steps };
}
