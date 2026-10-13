/**
 * The running game, as the architecture page draws it beneath the line: each piece that runs, the groups that say
 * which pieces fit together, and what passes between them. Where `readers.ts` says which baked files the running
 * game reads, this says what it is made of once it runs.
 */

/** Where a piece runs: in the player's browser, inside the game server's one process, or in Docker beside it. */
export type Runs = 'browser' | 'server' | 'docker';

export interface Piece {
  readonly id: string;
  readonly name: string;
  /** Where to find it: a folder, a class, or an address. */
  readonly where: string;
  readonly runs: Runs;
  /** The group it fits in; the page stands alone. */
  readonly group?: GroupId;
  readonly what: string;
  /** Not built yet, and which increment of the roadmap builds it. */
  readonly yet?: string;
  /** Stands in for another piece when that one is not there. */
  readonly instead?: string;
}

export type GroupId = 'server' | 'events';

export interface Group {
  readonly id: GroupId;
  readonly name: string;
  readonly where: string;
  readonly what: string;
}

/** What passes between two pieces: one way, or both ways, and whether it runs today. */
export interface Talk {
  readonly from: string;
  readonly to: string;
  readonly says: string;
  readonly both?: boolean;
  /** Only when Docker is not running, or not until an increment is built. */
  readonly when?: 'instead' | 'yet';
}

export const GROUPS: readonly Group[] = [
  {
    id: 'server',
    name: 'The game server',
    where: 'backend/app · one Java process a worktree, on its game port',
    what: 'Keeps the one world every player shares. Everything in this box is in its one process, and it reads the ground, the stands, the names and the portraits that are baked beside it.',
  },
  {
    id: 'events',
    name: 'The event store',
    where: 'Occurrent · MongoDB · the bridge · RabbitMQ',
    what: 'How the world is kept and passed on, four pieces with one job: Occurrent writes each event once and hands it on, MongoDB keeps it for good, and the bridge publishes every one to RabbitMQ, which carries it to the read models. Nothing is ever changed once written; everything else is worked out from it.',
  },
];

export const PIECES: readonly Piece[] = [
  {
    id: 'page',
    name: 'The page',
    where: 'frontend/apps/web',
    runs: 'browser',
    what: "One player's view of the world. It draws the map, the paint, the relief, the water and the scenery from the baked files, lays out the panes and windows the player reads, and sends what the player does to the gateway. It decides nothing about the world: it shows what it is told.",
  },
  {
    id: 'gateway',
    name: 'The gateway',
    where: 'backend/gateway · /ws on the game port',
    runs: 'server',
    group: 'server',
    what: "Holds one WebSocket a player. A player's commands go in to the rules; out comes the world, a snapshot of each cell the page asks for and then every change to it, cut to what the house's fog lets it see. A page and a server of different versions are told so at the handshake.",
  },
  {
    id: 'rules',
    name: 'The rules',
    where: 'backend/domain, backend/application',
    runs: 'server',
    group: 'server',
    what: "Decide every command. A house's history is read back and folded into where things stand, and the command is refused or turned into new events: what happened. The domain is the game's rules and knows nothing of any database; the application around it is the use cases, and the ports everything else plugs into.",
  },
  {
    id: 'reactions',
    name: 'The reactions',
    where: 'backend/application · Reaction',
    runs: 'server',
    group: 'server',
    what: 'The world acting on its own: followers of the feed that issue a command of their own for some of what they hear, as a pledge given back when its time is up, or the dialogues of somebody who died ended. Each plans its command for later, never inside the feed.',
  },
  {
    id: 'projections',
    name: 'The projections',
    where: 'backend/projections',
    runs: 'server',
    group: 'server',
    what: 'The world as it stands now: structures by cell, choices, key figures, sight, dialogues, the last rolls. Each folds the history from the store and then every event RabbitMQ carries, through a queue of its own, so the gateway can answer what is where without reading the history. Kept in memory, and folded again from the whole history every time the server starts, and after RabbitMQ has been away.',
  },
  {
    id: 'occurrent',
    name: 'Occurrent',
    where: 'backend/infrastructure-occurrent',
    runs: 'server',
    group: 'events',
    what: "The event-sourcing library, and the only code that touches the store. It reads a house's stream back for the rules, appends what they decided only if nobody wrote to that stream first, and runs the feed: every follower handed every event, the history first and then each one as it is written. The same code over MongoDB or memory.",
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    where: 'localhost:27017 · villages-<tree>',
    runs: 'docker',
    group: 'events',
    what: "Where the events are kept whenever Docker is running, so the world outlives the server. A replica set of one, because the feed's live half is its change streams. One MongoDB for the machine, from infra/docker-compose.yml, and a database of its own for every worktree.",
  },
  {
    id: 'memory',
    name: 'In memory',
    where: 'InMemoryWorld.kt',
    runs: 'server',
    group: 'events',
    instead: 'mongodb',
    what: "Where the events are kept when Docker is not running, and in every test: Occurrent's own store in the server's memory, behind the same ports, so nothing else can tell. Gone when the server stops, and a restart begins the world again.",
  },
  {
    id: 'bridge',
    name: 'The bridge',
    where: 'backend/infrastructure-rabbit',
    runs: 'server',
    group: 'events',
    what: 'Follows every event as it is written and publishes it to RabbitMQ, counting it carried only once RabbitMQ has confirmed it, and keeps its place in MongoDB. So an event written while the server or the broker was down is published once both are back. Only when the world is kept in MongoDB.',
  },
  {
    id: 'rabbitmq',
    name: 'RabbitMQ',
    where: 'localhost:5672 · villages-<tree> · page on :15672',
    runs: 'docker',
    group: 'events',
    what: "The broker. Every stored event is published to its exchange villages.events, in a virtual host of the worktree's own, addressed by its type and the cell it happened in, and the read models and the event page each follow it through a queue of their own. The reactions do not: they follow the store, so the world acts on while the broker is away. What will let more than one gateway serve one world.",
  },
];

export const TALKS: readonly Talk[] = [
  { from: 'page', to: 'gateway', says: 'one WebSocket a player', both: true },
  { from: 'gateway', to: 'rules', says: 'commands' },
  { from: 'rules', to: 'occurrent', says: "a house's history, and what was decided", both: true },
  { from: 'occurrent', to: 'mongodb', says: 'kept, and handed back', both: true },
  { from: 'occurrent', to: 'memory', says: 'or, without Docker', both: true, when: 'instead' },
  { from: 'occurrent', to: 'reactions', says: 'the feed, from the store' },
  { from: 'reactions', to: 'rules', says: 'commands, too' },
  { from: 'occurrent', to: 'projections', says: 'the history' },
  { from: 'projections', to: 'gateway', says: 'the world now' },
  { from: 'occurrent', to: 'bridge', says: 'every event, from where it stopped' },
  { from: 'bridge', to: 'rabbitmq', says: 'published, by cell' },
  { from: 'rabbitmq', to: 'projections', says: 'every event, a queue each' },
];

export function piece(id: string): Piece {
  const found = PIECES.find((p) => p.id === id);
  if (found === undefined) throw new Error(`no running piece called ${id}`);
  return found;
}

export function group(id: string): Group {
  const found = GROUPS.find((g) => g.id === id);
  if (found === undefined) throw new Error(`no running group called ${id}`);
  return found;
}
