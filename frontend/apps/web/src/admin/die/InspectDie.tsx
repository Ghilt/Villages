import './die.css';

import { useCallback, useEffect, useRef, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { MapView } from '../../map/MapView';
import { chosenMaster, worldRootOf } from '../../map/masters';
import { InspectPage } from '../frame/InspectPage';

import { DieControls, FIRST_DRAFT } from './DieControls';
import { startDieStage } from './dieStage';
import type { DieSettings, DieStage, Rested } from './dieStage';
import { Podium } from './Podium';

/**
 * The spike of `docs/plans/choice-roll-podium.md`: the choice roll's die on the real map, picked up from its podium by a
 * long press, hanging under the pointer or the finger, dropped or thrown, and put back in its slot. Its numbers are on
 * sliders, so the feel can be found before the game is given a die. Nothing is sent anywhere: where it rests is only
 * said here.
 */
export function InspectDie() {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [settings, setSettings] = useState<DieSettings>(FIRST_DRAFT);
  const [rested, setRested] = useState<Rested | null>(null);
  const [camera, setCamera] = useState({ zoom: 0, tilt: 0 });
  const [busy, setBusy] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<DieStage | null>(null);
  const chosen = useRef(settings);
  chosen.current = settings;

  // MapView makes its map again whenever this changes, so it is made once.
  const ready = useCallback((made: maplibregl.Map) => setMap(made), []);

  useEffect(() => {
    const into = host.current;
    if (map === null || into === null) return undefined;
    let gone = false;
    const say = () => setCamera({ zoom: map.getZoom(), tilt: map.getPitch() });
    say();
    map.on('move', say);
    void startDieStage(
      into,
      map,
      () => chosen.current,
      (came) => {
        setRested(came);
        setBusy(false);
      },
    ).then((made) => {
      if (gone) made.stop();
      else stage.current = made;
    });
    return () => {
      gone = true;
      map.off('move', say);
      stage.current?.stop();
      stage.current = null;
    };
  }, [map]);

  return (
    <InspectPage
      title="Die"
      epigraph="The choice roll's die, dropped and thrown on the map, to feel before it is built"
    >
      <p className="inspect-note">
        Move the map to where you want to roll, then press and hold the die on its podium until it lifts. Let
        go with the hand still to drop it by its shadow, with a flick to throw it, or over its empty slot to
        put it back; Enter on the podium drops it at the middle. Zoom out past 7 for a camera looking straight
        down, in to 10 for the player&apos;s 45 degrees. The ring is the landing circle. Nothing is sent to
        the game server.
      </p>
      <div className="die-spike">
        <div className="die-spike__map">
          <MapView worldRoot={worldRootOf(chosenMaster())} onReady={ready} />
          <div className="die-spike__stage" ref={host} />
          <Podium
            empty={busy}
            stage={stage}
            onPickUp={() => {
              setBusy(true);
              setRested(null);
            }}
            onPutBack={() => setBusy(false)}
          />
          <p className="die-spike__camera inspect-note">
            zoom {camera.zoom.toFixed(1)} · tilt {camera.tilt.toFixed(0)}°
          </p>
        </div>
        <DieControls
          settings={settings}
          onChange={setSettings}
          rested={rested}
          onPlant={() => stage.current?.plant()}
        />
      </div>
    </InspectPage>
  );
}
