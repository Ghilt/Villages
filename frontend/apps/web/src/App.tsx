import { useCallback, useEffect, useMemo, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { charactersInView, housesInView } from '@villages/client-core';
import type { CharacterOnMapView, ChoiceView, HouseView } from '@villages/protocol';

import { AreaOverlay } from './areas/AreaOverlay';
import { openOnArrival } from './dialogues/opening';
import { DebugPanel } from './debug/DebugPanel';
import { Desk } from './desk/Desk';
import { Grips } from './debug/Grips';
import { stageStore } from './debug/stage';
import { panelWants, stageBox } from './stage/stageBox';
import { note } from './log/log';
import { inspect } from './inspect/opening';
import { sessionStore, gateway } from './net/gateway';
import { followMap } from './net/followMap';
import { arriving } from './house/arrival';
import { eyeStore } from './house/eye';
import { HoldingOverlay } from './areas/HoldingOverlay';
import { StoodDown } from './net/StoodDown';
import { flyWith } from './map/focus';
import { MapStrip } from './map/MapStrip';
import { MapView } from './map/MapView';
import { Room } from './room/Room';
import { Stage } from './stage/Stage';
import type { PaneDef } from './stage/panes';
import { panesOn, standingIn } from './panes';
import { subjectsStore } from './inspect/subjects';
import { formNow, roomToRead, takeOver, theMapsBay } from './stage/bays';
import { CHOICE_PANE } from './choice/pane';
import { worldRootOf } from './map/masters';
import { cameraStore } from './map/camera';
import { DEFAULT_RENDERER, RENDERERS, applyRenderer } from './map/renderers';
import { SpriteOverlay } from './sprites/SpriteOverlay';
import type { MapSprite } from './sprites/SpriteRenderer';
import { tinctureColour } from './sprites/tinctures';
import { useStore } from './store/useStore';

/**
 * A house as the renderer draws it: a mark at its seat, in its field's tincture.
 *
 * `always` is the eye: a house drawn however far back the camera goes. Only ever the player's own, and
 * only while the eye is open. See decision record 0038.
 */
function toSprite(house: HouseView, always: boolean): MapSprite {
  return {
    id: house.id,
    at: { lng: house.seat.lon, lat: house.seat.lat },
    tint: tinctureColour(house.banner.field),
    kind: 'house',
    always,
  };
}

/** The soft ink of the interface, for somebody standing on the map whom no house holds. */
const NOBODYS = 0x8a7a64;

/**
 * A character as the renderer draws them: a figure at their place, in the colours of the house they serve,
 * which is the first that took them in. Their own id space, so a person and a house can never be one mark.
 */
function toCharacterSprite(character: CharacterOnMapView): MapSprite {
  const serves = character.keyFigureOf[0];
  return {
    id: `character:${character.id}`,
    at: { lng: character.place.lon, lat: character.place.lat },
    tint: serves === undefined ? NOBODYS : tinctureColour(serves.banner.field),
    kind: 'character',
  };
}

/** The gold of the interface, so a place being offered reads as the world asking rather than as a house. */
const OFFERED = 0x9d7c2a;

/**
 * The seats a pending choice is offering, as marks on the map.
 *
 * They are there so that the three places can be looked at before one is taken: set the parchment aside,
 * pull back, and see where the world is proposing to put you.
 */
function candidatesOf(choice: ChoiceView | null): MapSprite[] {
  if (choice === null) {
    return [];
  }
  return choice.options.flatMap((option) =>
    option.effect.kind === 'foundAt'
      ? [
          {
            id: `offered:${option.id}`,
            at: { lng: option.effect.seat.lon, lat: option.effect.seat.lat },
            tint: OFFERED,
            kind: 'candidate' as const,
          },
        ]
      : [],
  );
}

/**
 * How close the camera comes when the house is founded.
 *
 * Not a matter of taste: a new house has the founding significance, and `coarsestZoom` makes that zoom 8,
 * so a flight that stopped at 7 would land on a seat with nothing standing on it. Past 8 the sprite is
 * drawn as a marker rather than a dot, which is what arriving at your own house should look like.
 */
const FOUNDING_ZOOM = 8.5;

interface AppProps {
  /** Which hand-painted master this page load is drawing. Decided once, in main.tsx. */
  master: string;
}

/**
 * The window, as something a render can depend on.
 *
 * The stage is worked out from it rather than from a percentage, because the phone shape is a count of
 * pixels and half of the arithmetic has no percentage to be written as.
 */
function useWindow(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({
    width: globalThis.innerWidth,
    height: globalThis.innerHeight,
  }));
  useEffect(() => {
    const measure = () => setSize({ width: globalThis.innerWidth, height: globalThis.innerHeight });
    globalThis.addEventListener('resize', measure);
    return () => globalThis.removeEventListener('resize', measure);
  }, []);
  return size;
}

export function App({ master }: AppProps) {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [renderer, setRenderer] = useState(DEFAULT_RENDERER);
  // The lattice the ground is painted on, which is Adam's lever rather than a player's. See 0008.
  const camera = useStore(cameraStore);
  const houses = useStore(sessionStore, (state) => state.houses);
  const yourHouse = useStore(sessionStore, (state) => state.yourHouse);
  const yourChoice = useStore(sessionStore, (state) => state.yourChoice);
  const yourDialogues = useStore(sessionStore, (state) => state.yourDialogues);
  const eye = useStore(eyeStore, (state) => state.open);
  const mode = useStore(stageStore, (state) => state.mode);
  const shut = useStore(stageStore, (state) => state.shut);
  const log = useStore(stageStore, (state) => state.log);
  const window = useWindow();
  const wants = panelWants(shut, log);
  const box = useMemo(() => stageBox(window, mode, wants), [window, mode, wants]);
  const inView = useMemo(() => housesInView(houses), [houses]);
  const standing = useMemo(() => charactersInView(houses), [houses]);
  // The public half of your own house: what the map draws is the same view everyone else's house is
  // drawn from, and what only you can see hangs off it.
  const yours = yourHouse?.house ?? null;
  // With the eye open your own house is drawn whether or not a held cell carries it. It can be missing
  // from one and still be known, because the gateway sends it to the session rather than to a cell.
  const drawn = useMemo(
    () =>
      eye && yours !== null && !inView.some((house) => house.id === yours.id) ? [...inView, yours] : inView,
    [inView, eye, yours],
  );
  const sprites = useMemo(
    () => [
      ...drawn.map((house) => toSprite(house, eye && house.id === yours?.id)),
      ...standing.map(toCharacterSprite),
      ...candidatesOf(yourChoice),
    ],
    [drawn, standing, eye, yours, yourChoice],
  );

  // The one connection to the gateway, opened as the app mounts.
  useEffect(() => {
    gateway(master);
  }, [master]);

  // The gateway follows the camera: the cells covering the view, at the view's own zoom.
  useEffect(() => (map === null ? undefined : followMap(map)), [map]);

  // When the house arrives, the camera goes to it and its window opens: founded a moment ago, or standing
  // when the page loads, and never because it was sent again, which it is whenever anything in it changes.
  // Asked once the map is there, so a house heard before the map was ready still arrives. See `arrival.ts`.
  useEffect(() => {
    if (map !== null && yours !== null && arriving(yours)) {
      const { seat } = yours;
      note('camera', `flying to the seat at ${seat.lat.toFixed(3)}, ${seat.lon.toFixed(3)}`);
      map.flyTo({ center: [seat.lon, seat.lat], zoom: Math.max(map.getZoom(), FOUNDING_ZOOM) });
      inspect({ kind: 'house', id: yours.id });
    }
  }, [map, yours]);

  /*
   * A question arriving takes the big bay, and the small one keeps whatever was in it.
   *
   * Only in the bays: the spread has a tile of its own along the bottom middle, and nothing is displaced
   * to make room for it. Reading the question is the thing to do first, which is why it takes the map's
   * bay rather than the other one - and the carousel is how a player puts the map back beside it. The
   * takeover remembers, so answering gives the bay back. See decision record 0044.
   */
  const asking = yourChoice?.id;
  useEffect(() => {
    if (asking !== undefined && formNow() === 'bays') {
      const bay = theMapsBay();
      takeOver(bay, CHOICE_PANE.id);
      // A letter that arrived as a strip is a question the player cannot read. See decision record 0046.
      roomToRead(bay);
    }
  }, [asking]);

  /*
   * A dialogue arriving opens the pane: from its strip in the spread, and on a phone into the bay that is
   * not the map's, as a window does, because the map is where the player was looking. What has arrived is
   * the opening's to say: a dialogue waiting that this page has not been shown before. See `MECHANICS.md`.
   */
  const offered = yourDialogues;
  useEffect(() => {
    if (offered !== null) {
      openOnArrival(offered);
    }
  }, [offered]);

  useEffect(() => {
    if (map !== null) {
      applyRenderer(map, renderer, { turn: camera.latticeTurn, size: camera.latticeSize });
      const chosen = RENDERERS.find((candidate) => candidate.name === renderer);
      note('renderer', `${renderer}${chosen === undefined ? '' : `, ${chosen.note.toLowerCase()}`}`);
    }
  }, [map, renderer, camera.latticeTurn, camera.latticeSize]);

  // How an inspect window's "show it on the map" link reaches the camera, without anything in the interface
  // having to be handed a map it has no business holding.
  useEffect(() => {
    if (map === null) {
      return;
    }
    flyWith((place) => {
      note('camera', `showing ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}`);
      map.flyTo({ center: [place.lon, place.lat], zoom: Math.max(map.getZoom(), FOUNDING_ZOOM) });
    });
    return () => flyWith(null);
  }, [map]);

  const worldRoot = worldRootOf(master);

  // The map's own pane, App's because App holds the map; every other pane is drawn by its feature, and which
  // stand and in what order is `panes.tsx`'s.
  const drawMap = useCallback<PaneDef['draw']>(
    (room, along) => (
      <>
        {/* The map, the desk it lies on and the room the desk stands in, which is the one thing
              that can scale them all together once the camera has run out of zoom. The overlays
              below draw nothing of their own and stay outside it. See experiment 0009. */}
        <Room map={map} seat={yours?.seat ?? null} strip={along !== null && room.size === 'strip'}>
          <Desk map={map} />
          <MapView worldRoot={worldRoot} onReady={setMap} />
          {map !== null && <SpriteOverlay map={map} sprites={sprites} worldRoot={worldRoot} />}
        </Room>
        <AreaOverlay map={map} worldRoot={worldRoot} turn={camera.latticeTurn} />
        <HoldingOverlay map={map} houses={drawn} mine={eye ? yours : null} turn={camera.latticeTurn} />
        {/* Put away, and still running underneath: a lid over the map, never instead of it. The
              guard is the form rather than the size, because what a pane was asked to be outlives
              the fold - and the floor of the spread is never put away. See `MapStrip`. */}
        {along !== null && room.size === 'strip' && <MapStrip room={room} />}
      </>
    ),
    [map, yours, worldRoot, sprites, camera.latticeTurn, drawn, eye],
  );
  const up = useStore(sessionStore, standingIn);
  const open = useStore(subjectsStore, (subjects) => subjects.open);
  const panes = useMemo(() => panesOn(up, open, drawMap), [up, open, drawMap]);

  // The four numbers the grid is laid out from. As custom properties rather than as a style object on
  // each child, so that a drag moves one declaration and the browser does the rest.
  const grid = {
    '--blank': `${box.blank}px`,
    '--stage-w': `${box.stage.w}px`,
    '--stage-h': `${box.stage.h}px`,
    '--panel': `${box.panel}px`,
    '--inset': `${box.inset}px`,
  } as React.CSSProperties;

  return (
    <main className="app" style={grid}>
      {/*
       * Everything a player would ever see, and nothing else, inside a box the debug panel takes room
       * from. That is what makes the phone toggle worth having: what is left at 390 pixels is what a
       * player would actually get. See decision record 0039.
       *
       * The stage divides itself: one box in the spread, two bays once there is no longer room for
       * everything at once. A pane is handed the room it got and draws itself at that size; nothing here
       * knows which bay anything is in. See decision record 0040.
       */}
      <Stage stage={box.stage} panes={panes} overlays={<StoodDown />} />

      <DebugPanel
        map={map}
        worldRoot={worldRoot}
        master={master}
        renderer={renderer}
        onRenderer={setRenderer}
      />

      <Grips box={box} wants={wants} />
    </main>
  );
}
