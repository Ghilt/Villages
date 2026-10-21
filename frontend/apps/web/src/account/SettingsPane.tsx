import { useState } from 'react';

import { PaneSizeControl } from '../stage/PaneSizeControl';
import type { Room } from '../stage/panes';
import { TextButton } from '../ui/button/Button';
import { logOut, SettingsParts, TITLES, useAnAccount } from './Settings';
import type { View } from './Settings';

/**
 * The settings on a phone, in the pane below: the same parts as the spread's dialog, under their name, scrolling in
 * the room the pane was given. A way to an account opens in the pane in their place, with a way back, and logging
 * out is at their foot for an account. Put away it is its name, as any pane's strip is.
 */
export function SettingsPane({ room }: { room: Room }) {
  const [view, show] = useState<View>('settings');
  const account = useAnAccount();

  if (room.size === 'strip') {
    return (
      <section className="settings-pane settings-pane--strip pane-card pane-strip" aria-label="Settings">
        <span className="settings-pane__kind">Settings</span>
        <PaneSizeControl room={room} />
      </section>
    );
  }

  return (
    <section className="settings-pane pane-card" aria-label="Settings">
      <header className="settings-pane__bar">
        <h2 className="settings-pane__head">{TITLES[view]}</h2>
        <PaneSizeControl room={room} />
      </header>
      <div className="settings-pane__body">
        <SettingsParts view={view} show={show} onLeave={() => show('settings')} />
        {view === 'settings' && account && (
          <div className="settings__row">
            <TextButton face="secondary" onClick={logOut}>
              Log out
            </TextButton>
          </div>
        )}
        {(view === 'create' || view === 'signIn') && (
          <div className="settings__row settings-pane__back">
            <TextButton face="secondary" onClick={() => show('settings')}>
              Back to the settings
            </TextButton>
          </div>
        )}
      </div>
    </section>
  );
}
