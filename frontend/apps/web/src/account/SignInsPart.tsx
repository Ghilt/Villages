import { useCallback, useEffect, useState } from 'react';

import { note } from '../log/log';
import { signIns, signOutEverywhereElse, signOutThere } from '../net/auth';
import type { SignInRow } from '../net/auth';
import { TextButton } from '../ui/button/Button';

const KEPT: Record<SignInRow['keeping'], string> = {
  remembered: 'remembered',
  forNow: 'until the browser closes',
  guest: 'a guest’s',
};

/** When a sign-in was last used, as a person reads it. */
function lastUsed(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 2) return 'in use now';
  if (minutes < 120) return `used ${minutes} minutes ago`;
  return `used ${new Date(at).toLocaleDateString(undefined, { dateStyle: 'medium' })}`;
}

/**
 * Every browser signed in to this account, the newest used first, this one marked: each with *Sign out there*, which
 * ends that sign-in on the server and stands its windows down, and *Sign out everywhere else*. What to do with a
 * browser left signed in somewhere, or one that was not yours. See docs/plans/accounts.md.
 */
export function SignInsPart() {
  const [rows, setRows] = useState<SignInRow[] | null>(null);

  const refresh = useCallback(() => {
    signIns().then(setRows, () => setRows(null));
  }, []);
  useEffect(refresh, [refresh]);

  const out = (row: SignInRow) => {
    void signOutThere(row.id).then(() => {
      note('accounts', `signed out of ${row.browser}`);
      refresh();
    });
  };
  const othersOut = () => {
    void signOutEverywhereElse().then(() => {
      note('accounts', 'signed out of every other browser');
      refresh();
    });
  };

  if (rows === null) return null;
  return (
    <section className="settings__part" aria-label="Where you are signed in">
      <h3 className="ui-caps settings__title">Where you are signed in</h3>
      <ul className="settings__signins">
        {rows.map((row) => (
          <li key={row.id} className="settings__signin">
            <span className="ui-body">
              {row.browser}
              {row.here ? ', this one' : ''}
            </span>
            <span className="ui-label">
              {KEPT[row.keeping]}, {lastUsed(row.lastUsed)}
            </span>
            {!row.here && (
              <TextButton face="secondary" size="small" onClick={() => out(row)}>
                Sign out there
              </TextButton>
            )}
          </li>
        ))}
      </ul>
      {rows.length > 1 && (
        <div className="settings__row">
          <TextButton face="secondary" size="small" onClick={othersOut}>
            Sign out everywhere else
          </TextButton>
        </div>
      )}
    </section>
  );
}
