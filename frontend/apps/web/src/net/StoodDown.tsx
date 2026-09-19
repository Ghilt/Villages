import { useSyncExternalStore } from 'react';

import { gatewayState, watchGateway } from '../net/gateway';

/**
 * What a window says once another one has taken the player over.
 *
 * A player plays from one place (decision record 0028), and the window that lost is finished: it holds no
 * cells, hears nothing and can do nothing. Without this it would not look finished - the map still pans,
 * the scrubber still slides, the terrain is still there - and the only tell would be a greyed button and a
 * row in a panel that may be minimised. A thing that has stopped has to look stopped.
 *
 * The way back is a reload, because whoever says hello last is the session: this window can simply take
 * the player back.
 */
export function StoodDown() {
  const heard = useSyncExternalStore(watchGateway, gatewayState);

  if (heard.connection !== 'takenOver') {
    return null;
  }

  return (
    <div className="stood-down" role="alertdialog" aria-label="this window is no longer playing">
      <div className="stood-down__card">
        <p className="stood-down__title">Playing elsewhere</p>
        <p className="stood-down__words">
          This house is being played in another window. A house is played from one place at a time.
        </p>
        <button type="button" className="stood-down__back" onClick={() => window.location.reload()}>
          play here instead
        </button>
      </div>
    </div>
  );
}
