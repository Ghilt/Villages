import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { gatewayState, viewAt, watchGateway } from '../net/gateway';
import { describeViewing, scrubberRange } from './scrubber';

/** How long the scrubber waits after the last movement before asking the gateway: a drag is many events. */
const SETTLE_MS = 120;

/**
 * The timeline along the bottom of the map: which day of the world is being looked at. Drag it back and
 * the map shows the world as it was; let it rest at the right-hand end and the world is live. Every move
 * is one frame to the gateway, which answers with every held cell as of that day. See decision 0027.
 *
 * The first of the two tools the milestone in SETTING.md names, the map being the other.
 */
export function Timeline() {
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const [dragging, setDragging] = useState<number | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(settle.current), []);

  if (heard.world === null) {
    return null;
  }
  const world = heard.world;
  const range = scrubberRange(world);
  const shown = dragging ?? heard.viewingAt ?? range.to;
  const live = shown >= range.to;

  const moved = (day: number) => {
    setDragging(day);
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      viewAt(day >= range.to ? null : day);
      setDragging(null);
    }, SETTLE_MS);
  };

  return (
    <div className={`timeline${live ? '' : ' timeline--past'}`}>
      <input
        type="range"
        className="timeline__slider"
        aria-label="the day of the world being looked at"
        min={range.from}
        max={range.to}
        step={1}
        value={shown}
        onChange={(event) => moved(Number(event.target.value))}
      />
      <div className="timeline__label">
        <span>{describeViewing(live ? null : shown, world)}</span>
        {!live && (
          <button type="button" className="debug__button" onClick={() => moved(range.to)}>
            back to live
          </button>
        )}
      </div>
    </div>
  );
}
