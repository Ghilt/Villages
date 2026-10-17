import './renders.css';

import { useEffect, useMemo, useRef, useState } from 'react';

import { paintFile } from '../../geometry/terrainClasses';
import type { PaintFile } from '../../geometry/terrainClasses';
import { chosenMaster, worldRootOf } from '../../map/masters';
import { motionOf } from '../../sprites/land/look';
import { InspectPage } from '../frame/InspectPage';

import { GAP, SQUARE, rendersLayout, squaresOf } from './squares';
import { boardOf, startRenders } from './stage';

/**
 * A square of every kind of land side by side, and one for each critter, drawn by the map's own shaders: the paint,
 * the land moving in the wind and the light, the trees bending, and the critters coming and going, a critter's own
 * square putting one in its middle every few seconds. One zoom and a camera that never moves, so a look can be
 * compared across every kind at once without hunting the map for it. The sliders of the debug panel's Shaders section
 * are remembered in this browser, so what they were left at in the game is what is drawn here. The water's own motion
 * and the clouds are not here.
 */
export function InspectRenders() {
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [paint, setPaint] = useState<PaintFile | null>(null);
  const [width, setWidth] = useState(0);
  const [painting, setPainting] = useState(true);
  useEffect(() => {
    void paintFile().then(setPaint);
  }, []);
  useEffect(() => {
    const box = wrap.current;
    if (box === null) return undefined;
    const measure = () => setWidth(box.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => {
    if (paint === null || width === 0) return null;
    const groups = Object.keys((paint.palette as { groupTitles?: Record<string, string> }).groupTitles ?? {});
    const kinds = paint.palette.classes.map((one) => ({
      id: one.id,
      name: one.name,
      group: one.group ?? '',
    }));
    const scale = boardOf(rendersLayout(kinds, groups, 1)).scale;
    const columns = Math.max(5, Math.floor((width / scale - 2 + GAP) / (SQUARE + GAP)));
    return rendersLayout(kinds, groups, columns);
  }, [paint, width]);

  useEffect(() => {
    const into = host.current;
    if (layout === null || into === null) return undefined;
    let gone = false;
    let stop: (() => void) | null = null;
    setPainting(true);
    void startRenders(into, layout, worldRootOf(chosenMaster()), () => setPainting(false)).then((stage) => {
      if (gone) stage.stop();
      else stop = stage.stop;
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, [layout]);

  const board = layout === null ? null : boardOf(layout);
  return (
    <InspectPage title="Renders" epigraph="Every kind of land and every critter, as the map draws them">
      <p className="inspect-note">
        A square of every kind of land, at zoom 10, with the land layer, the trees in the wind and the
        critters as the map draws them, and under the lands a square for each critter, one put in its middle
        every few seconds. The sliders of the debug panel&apos;s Shaders section are remembered in this
        browser, so they are drawn here as the game was left. The water&apos;s own motion and the clouds are
        not drawn here.
        {painting && ' Painting the squares…'}
      </p>
      <div ref={wrap} className="renders">
        {layout !== null && board !== null && (
          <div className="renders__board" style={{ width: board.width, height: board.height }}>
            <div ref={host} className="renders__canvas" />
            {squaresOf(layout).map((square) => (
              <div
                key={`${square.land}/${square.critter?.kind ?? ''}`}
                className="renders__label"
                style={{
                  left: (square.x - board.x) * board.scale,
                  top: (square.y - board.y) * board.scale,
                  maxWidth: SQUARE * board.scale,
                }}
              >
                <span className="renders__name">{square.critter?.kind ?? square.land}</span>{' '}
                <span className="renders__motion">
                  {square.critter !== undefined ? square.land : (motionOf(square.land) ?? '')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </InspectPage>
  );
}
