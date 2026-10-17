import { useEffect, useState } from 'react';

import { listPlayers, sessionStore, switchPlayer } from '../net/gateway';
import { useStore } from '../store/useStore';

/**
 * The players of this world, by their houses' names, to play as one: a dropdown and a button, as the saves are. Asked
 * for whenever the connection opens and whenever the dropdown is opened, because a seeding brings twenty more. The
 * player this browser is now is marked, and is no switch. See decision record 0101.
 */
export function PlayersPicker() {
  const connection = useStore(sessionStore, (state) => state.connection);
  const players = useStore(sessionStore, (state) => state.players);
  const me = useStore(sessionStore, (state) => state.playerId);
  const [picked, setPicked] = useState('');

  useEffect(() => {
    if (connection === 'open') listPlayers();
  }, [connection]);

  if (players === null || players.length === 0) return null;
  const others = players.filter((one) => one.player !== me);
  const chosen = others.some((one) => one.player === picked) ? picked : (others[0]?.player ?? '');
  return (
    <div className="debug__levers">
      <select
        className="debug-map__select debug-saves__pick"
        value={chosen}
        onChange={(event) => setPicked(event.target.value)}
        onFocus={() => listPlayers()}
        aria-label="a player to play as"
      >
        {players.map((one) => (
          <option key={one.player} value={one.player} disabled={one.player === me}>
            {one.house}
            {one.player === me ? ' · you' : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="debug__button"
        onClick={() => switchPlayer(chosen)}
        disabled={chosen === ''}
        title="play as this house's player from now on"
      >
        switch
      </button>
    </div>
  );
}
