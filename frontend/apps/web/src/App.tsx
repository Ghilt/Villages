import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { charactersInView, structuresInView } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { AreaOverlay } from './areas/AreaOverlay';
import { openOnArrival } from './dialogues/opening';
import { openOnArrival as openQuestOnArrival, questDialogues } from './quests/opening';
import type * as DevToolsModule from './debug/devTools';
import type { StageArrangement } from './debug/stage';
import { Desk } from './desk/Desk';
import { panelWants, stageBox } from './stage/stageBox';
import { note } from './log/log';
import { inspect } from './inspect/opening';
import { WaterClicks } from './inspect/WaterClicks';
import { RippleAlongWater } from './inspect/RippleAlongWater';
import { sessionStore, gateway } from './net/gateway';
import { followMap } from './net/followMap';
import { FOUNDING_ZOOM, arriving } from './house/arrival';
import { startAtIn } from './net/startAt';
import { InfluenceZone } from './areas/InfluenceZone';
import { StoodDown } from './net/StoodDown';
import { StartupScreen } from './startup/StartupScreen';
import { startupStore, watchStartup } from './startup/startup';
import { flyWith } from './map/focus';
import { MapSize } from './map/MapSize';
import { MapView } from './map/MapView';
import { Room } from './room/Room';
import { Stage } from './stage/Stage';
import type { PaneDef } from './stage/panes';
import { panesOn, standingIn } from './panes';
import { subjectsStore } from './inspect/subjects';
import { arrive } from './stage/arrive';
import { lookThrough } from './looking';
import { askFor, formNow } from './stage/bays';
import { CHOICE_PANE } from './choice/pane';
import { cultureOfPlace, useCultureMap } from './map/culture';
import { worldRootOf } from './map/masters';
import { cameraStore } from './map/camera';
import { placeRelief } from './map/relief';
import { DEFAULT_RENDERER, RENDERERS, applyRenderer } from './map/renderers';
import { watchInfoMap } from './map/infoMap';
import { SpriteOverlay } from './sprites/SpriteOverlay';
import { CritterClicks } from './sprites/critters/CritterClicks';
import { placeWater } from './water/WaterLayer';
import { setFlowView, waterStore } from './water/waterMode';
import { candidatesOf, toCharacterSprite, toStructureSprite } from './mapSprites';
import { useStructureCatalogue } from './net/structureCatalogue';
import { useStore } from './store/useStore';

/** What a development build adds to the page: the debug panel, its grips, and how the two are arranged. */
export type DevTools = typeof DevToolsModule;

/** The stage in a player's build, which has no panel: the whole window, as a panel shut to its badge leaves it. */
const WHOLE_WINDOW: StageArrangement = { mode: 'fill', shut: true, log: false };
const NO_PANEL: Readable<StageArrangement> = {
  get: () => WHOLE_WINDOW,
  watch: () => () => undefined,
};

interface AppProps {
  /** Which hand-painted master this page load is drawing. Decided once, in main.tsx. */
  master: string;
  /** The debug panel and its grips in a development build, and null in a player's. See decision record 0079. */
  devTools: DevTools | null;
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

export function App({ master, devTools }: AppProps) {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [renderer, setRenderer] = useState(DEFAULT_RENDERER);
  // The lattice the ground is painted on, which is Adam's lever rather than a player's. See 0008.
  const camera = useStore(cameraStore);
  const onTheMap = useStore(sessionStore, (state) => state.onTheMap);
  const yourHouse = useStore(sessionStore, (state) => state.yourHouse);
  const holdings = useStore(sessionStore, (state) => state.yourHoldings);
  const keyFigures = useStore(sessionStore, (state) => state.yourKeyFigures);
  const yourChoice = useStore(sessionStore, (state) => state.yourChoice);
  const yourDialogues = useStore(sessionStore, (state) => state.yourDialogues);
  const arrangement = devTools?.stageStore ?? NO_PANEL;
  const mode = useStore(arrangement, (state) => state.mode);
  // Whether the loading screen has lifted, which the sprite canvas waits on to begin what it keeps off the start.
  const started = useStore(startupStore, (state) => state.lifted);
  const shut = useStore(arrangement, (state) => state.shut);
  const log = useStore(arrangement, (state) => state.log);
  const window = useWindow();
  const wants = panelWants(shut, log);
  const box = useMemo(() => stageBox(window, mode, wants), [window, mode, wants]);
  const standing = useMemo(() => charactersInView(onTheMap), [onTheMap]);
  const raised = useMemo(() => structuresInView(onTheMap), [onTheMap]);
  const catalogue = useStructureCatalogue();
  // The culture each structure stands in, read off the culture map of the master drawn, so its picture is drawn in it.
  const cultures = useCultureMap(master);
  // The public half of your own house: what the map draws is the same view everyone else's house is
  // drawn from, and what only you can see hangs off it.
  const yours = yourHouse?.house ?? null;

  // What a choice roll reads of the camera, where it is centred and how close. See `looking.ts`.
  useEffect(() => lookThrough(map), [map]);
  // Your own holdings and key figures are drawn whether or not a held cell carries them, and however far back the
  // camera goes, because far out they are your marks: the gateway sends them to the session rather than to a cell.
  // No house is drawn: its structures are. See decision record 0096.
  const drawn = useMemo(
    () =>
      holdings === null
        ? raised
        : [...raised, ...holdings.filter((one) => !raised.some((r) => r.id === one.id))],
    [raised, holdings],
  );
  const people = useMemo(
    () => [
      ...standing,
      ...(keyFigures ?? []).flatMap((one) =>
        one.place === undefined || standing.some((there) => there.id === one.id)
          ? []
          : [{ ...one, place: one.place }],
      ),
    ],
    [standing, keyFigures],
  );
  // Structures first, so that a person standing in front of one is drawn over it.
  const sprites = useMemo(
    () => [
      ...drawn.map((structure) =>
        toStructureSprite(
          structure,
          catalogue,
          cultureOfPlace(cultures, structure.place),
          structure.holder !== undefined && structure.holder.id === yours?.id,
        ),
      ),
      ...people.map((one) => toCharacterSprite(one, one.keyFigureOf[0]?.id === yours?.id && yours !== null)),
      ...candidatesOf(yourChoice),
    ],
    [drawn, catalogue, cultures, people, yours, yourChoice],
  );

  // The one connection to the gateway, opened as the app mounts.
  useEffect(() => {
    gateway(master);
  }, [master]);

  // The gateway follows the camera: the cells covering the view, at the view's own zoom.
  useEffect(() => (map === null ? undefined : followMap(map)), [map]);

  // The loading screen, until the map is drawn where the player starts. See `startup/startup.ts`.
  useEffect(() => (map === null ? undefined : watchStartup(map)), [map]);

  // When the house arrives, the camera goes to it and its window opens: founded a moment ago, or standing
  // when the page loads, and never because it was sent again, which it is whenever anything in it changes.
  // Asked once the map is there, so a house heard before the map was ready still arrives. See `arrival.ts`.
  // A page opened by a map link stays where the link put it; the house's window opens all the same. Under the
  // loading screen there is no flight: the startup puts the camera on the seat, and lifts once it is drawn there.
  // Not on a phone, where a window takes the map's place on top and would hide the flight to the seat; the
  // house status is already below it there. See decision record 0109.
  useEffect(() => {
    if (map !== null && yours !== null && arriving(yours)) {
      const { seat } = yours;
      if (startAtIn(globalThis.location.search) === null && startupStore.get().lifted) {
        note('camera', `flying to the seat at ${seat.lat.toFixed(3)}, ${seat.lon.toFixed(3)}`);
        map.flyTo({ center: [seat.lon, seat.lat], zoom: Math.max(map.getZoom(), FOUNDING_ZOOM) });
      }
      if (formNow() !== 'bays') {
        inspect({ kind: 'house', id: yours.id });
      }
    }
  }, [map, yours]);

  /*
   * A question arriving opens the letter: on a phone below the map, as every pane but a window stands, opened
   * to half if it was put away, and in the spread opened out over everything, nothing displaced to make room
   * for it. See decision records 0044 and 0109.
   */
  const asking = yourChoice?.id;
  const asked = useRef(false);
  const housed = yours !== null;
  useEffect(() => {
    if (asking !== undefined) {
      asked.current = true;
      // Opened out, over everything in the spread: the letter is put away or opened out there. See 0085.
      arrive(CHOICE_PANE.id, { inTheSpread: 'full' });
    } else if (asked.current && housed) {
      // Answered: in the spread the pane goes back to Take action, put away to its strip; on a phone it stays
      // where it stands, Take action below the map. Not until there is a house, because the founding is answered
      // a moment before the house arrives, and in that moment the pane stands nowhere to be put away. See 0083.
      asked.current = false;
      if (formNow() !== 'bays') askFor(CHOICE_PANE.id, 'strip');
    }
  }, [asking, housed]);

  /*
   * A dialogue arriving opens the pane: from its strip in the spread, and on a phone below the map, where every
   * pane but a window stands. What has arrived is the opening's to say: a dialogue waiting that this page has
   * not been shown before. See `MECHANICS.md`.
   */
  const offered = yourDialogues;
  useEffect(() => {
    if (offered !== null) {
      openOnArrival(offered, questDialogues(sessionStore.get().yourQuests));
    }
  }, [offered]);

  // A quest arriving opens its tab in the column, as a dialogue arriving opens its own; a dialogue a quest leads to
  // arrives through the quest. See decision record 0096.
  const quested = useStore(sessionStore, (state) => state.yourQuests);
  useEffect(() => {
    if (quested !== null) {
      openQuestOnArrival(quested);
    }
  }, [quested]);

  useEffect(() => {
    if (map !== null) {
      applyRenderer(map, renderer, { turn: camera.latticeTurn, size: camera.latticeSize });
      // The relief and then the water, over whichever renderer this is, the water over the relief.
      placeRelief(map, worldRootOf(master), { turn: camera.latticeTurn, size: camera.latticeSize });
      setFlowView(renderer === 'flow');
      placeWater(map, worldRootOf(master));
      map.triggerRepaint();
      const chosen = RENDERERS.find((candidate) => candidate.name === renderer);
      note('renderer', `${renderer}${chosen === undefined ? '' : `, ${chosen.note.toLowerCase()}`}`);
    }
  }, [map, renderer, camera.latticeTurn, camera.latticeSize, master]);

  // The Info map's names, written over the map while it is the renderer. See `map/infoMap.ts`.
  useEffect(
    () => (map === null || renderer !== 'info-map' ? undefined : watchInfoMap(map, master)),
    [map, renderer, master],
  );

  // The water's switch redraws the map, so the new way of drawing it shows at once.
  const water = useStore(waterStore, (state) => `${state.level} ${state.look}`);
  useEffect(() => {
    map?.triggerRepaint();
  }, [map, water]);

  // How an inspect window's "show it on the map" link reaches the camera, without anything in the interface
  // having to be handed a map it has no business holding.
  useEffect(() => {
    if (map === null) {
      return;
    }
    flyWith((place, zoom) => {
      note('camera', `showing ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}`);
      map.flyTo({ center: [place.lon, place.lat], zoom: zoom ?? Math.max(map.getZoom(), FOUNDING_ZOOM) });
    });
    return () => flyWith(null);
  }, [map]);

  const worldRoot = worldRootOf(master);
  const up = useStore(sessionStore, standingIn);
  // What is open, the newest first: the windows on the stage, and what the map marks.
  const open = useStore(subjectsStore, (subjects) => subjects.open);
  // What the map marks: the newest thing opened, and for a house its seat, which is where a house is on the map.
  const marked = useMemo(() => {
    const top = open[0];
    const seat = top?.kind === 'house' ? drawn.find((one) => one.seatOf?.id === top.id) : undefined;
    return seat === undefined ? top : { kind: 'structure' as const, id: seat.id };
  }, [open, drawn]);
  // The ground the marked structure reaches, drawn while it is marked, for a type the catalogue gives a zone.
  const zone = useMemo(() => {
    const structure = marked?.kind === 'structure' ? drawn.find((one) => one.id === marked.id) : undefined;
    const reach = catalogue?.types.find((one) => one.type === structure?.structureType)?.zone?.reach;
    return structure === undefined || reach === undefined
      ? null
      : { id: structure.id, at: structure.place, reach };
  }, [marked, drawn, catalogue]);

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
          {map !== null && (
            <SpriteOverlay
              map={map}
              sprites={sprites}
              worldRoot={worldRoot}
              picked={marked}
              onPick={inspect}
              started={started}
            />
          )}
        </Room>
        {/* Before the areas' and the water's, so that a click putting a critter down is only that. */}
        <CritterClicks map={map} />
        <AreaOverlay
          map={map}
          worldRoot={worldRoot}
          turn={camera.latticeTurn}
          picked={open[0]}
          onPick={inspect}
        />
        {/* After the marks' and the areas', so that a click neither took asks what water is there. */}
        <WaterClicks map={map} onPick={inspect} />
        <RippleAlongWater map={map} worldRoot={worldRoot} />
        <InfluenceZone map={map} zone={zone} turn={camera.latticeTurn} />
        {/* On a phone, the size control in the map's corner over a little fade, and nothing else. Never in
              the spread, where the map is the floor and has no size. See `MapSize`. */}
        {along !== null && <MapSize room={room} />}
      </>
    ),
    [map, yours, worldRoot, sprites, camera.latticeTurn, open, marked, zone, started],
  );
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
      <Stage
        stage={box.stage}
        panes={panes}
        overlays={
          <>
            <StoodDown />
            <StartupScreen />
          </>
        }
      />

      {devTools !== null && (
        <>
          <devTools.DebugPanel
            map={map}
            worldRoot={worldRoot}
            master={master}
            renderer={renderer}
            onRenderer={setRenderer}
          />
          <devTools.Grips box={box} wants={wants} />
        </>
      )}
    </main>
  );
}
