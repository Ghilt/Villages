import type { Reader } from './types';

/** Every part of the running game that reads a baked file. */
export const READERS: readonly Reader[] = [
  {
    id: 'world-style',
    program: 'page',
    name: 'the map',
    where: 'map/worldStyle.ts',
    reads: ['tiles', 'outlines'],
  },
  {
    id: 'terrain-classes',
    program: 'page',
    name: 'ground classes',
    where: 'geometry/terrainClasses.ts',
    reads: ['tiles', 'paint'],
  },
  {
    id: 'painterly-tiles',
    program: 'page',
    name: 'the paint',
    where: 'map/painterlyTiles.ts',
    reads: ['tiles'],
  },
  { id: 'flow-files', program: 'page', name: 'moving water', where: 'water/flowFiles.ts', reads: ['flow'] },
  {
    id: 'sprite-map',
    program: 'page',
    name: 'scenery placing',
    where: 'sprites/scenery/spriteMap.ts',
    reads: ['sprite-map'],
  },
  {
    id: 'scenery-layer',
    program: 'page',
    name: 'scenery drawing',
    where: 'sprites/scenery/SceneryLayer.ts',
    reads: ['art-atlas'],
  },
  {
    id: 'world-names',
    program: 'page',
    name: 'names on the map',
    where: 'map/worldNames.ts',
    reads: ['origin', 'names'],
  },
  {
    id: 'renderers',
    program: 'page',
    name: 'Biome and Origin renderers',
    where: 'map/renderers.ts',
    reads: ['sprite-map', 'origin'],
  },
  {
    id: 'relief',
    program: 'page',
    name: 'the relief',
    where: 'map/relief.ts, reliefTiles.ts',
    reads: ['height'],
  },
  {
    id: 'ui-pictures',
    program: 'page',
    name: 'interface dress',
    where: 'ui/art/pictures.ts',
    reads: ['ui-cut'],
  },
  {
    id: 'page-portraits',
    program: 'page',
    name: 'portraits',
    where: 'figures/portraits.ts',
    reads: ['portraits'],
  },
  {
    id: 'page-scenes',
    program: 'page',
    name: 'dialogue scenes',
    where: 'dialogues/scenes.ts',
    reads: ['scenes'],
  },
  { id: 'folder-stands', program: 'server', name: 'stands', where: 'FolderStands.kt', reads: ['stands'] },
  {
    id: 'folder-ground',
    program: 'server',
    name: 'ground, for rolls and water',
    where: 'FolderGround.kt',
    reads: ['ground'],
  },
  { id: 'folder-names', program: 'server', name: 'names', where: 'FolderNames.kt', reads: ['names-server'] },
  {
    id: 'folder-portraits',
    program: 'server',
    name: 'portraits',
    where: 'FolderPortraits.kt',
    reads: ['portraits'],
  },
];

/** What the running game keeps that is not a file: made as it runs, gone when it stops. */
export const LIVE: readonly {
  readonly id: string;
  readonly name: string;
  readonly where: string;
  readonly what: string;
}[] = [
  {
    id: 'gateway',
    name: 'the gateway',
    where: 'ws://localhost:<game port>/ws',
    what: "Carries everything between a page and the game server, both ways, on one WebSocket a player: the page's commands in, and the world as the player may see it out. A page and a server of different versions are told so here, at the handshake.",
  },
  {
    id: 'event-store',
    name: 'the event store',
    where: 'InMemoryWorld.kt',
    what: "The world's memory: every event that has happened, in order, one stream a house, never changed once written. Everything the server knows is worked out from it. In memory for now and MongoDB later, so a restart begins the world again.",
  },
  {
    id: 'projections',
    name: 'the projections',
    where: 'backend/projections',
    what: 'The world as it stands now, kept up to date from each event as it is stored, so the server can answer what is where without reading the whole history. In memory, and rebuilt from the events.',
  },
];

/** What each running program is responsible for, said plainly. */
export const PROGRAMS = {
  page: {
    name: 'The page',
    where: 'frontend/apps/web, in the browser',
    what: "One player's view of the world: it draws the map, its paint, the relief, the water and the scenery from the baked files, lays out the panes and windows the player reads and presses, and sends what the player does to the game server. It decides nothing about the world itself.",
  },
  server: {
    name: 'The game server',
    where: 'backend/app, on the machine',
    what: "Keeps the one world every player shares: it takes each player's commands, decides them by the game's rules, stores what happened as events, and tells each page only what its player may see through the fog. It reads the ground, the stands and the names beside it to know what a player is looking at.",
  },
} as const;
