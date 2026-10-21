import { useCallback, useEffect, useState } from 'react';

import { note, shortId } from '../log/log';
import { meStore, outbox, runOut, whoAmI } from '../net/auth';
import type { Mail, Me } from '../net/auth';
import { useStore } from '../store/useStore';
import { Section } from './Section';

/** How a sign-in is kept, in the words the panel says it in. */
const KEPT: Record<NonNullable<Me['signIn']>['keeping'], string> = {
  guest: "a guest's, always remembered",
  remembered: 'remembered',
  forNow: 'until the browser closes',
};

/** A moment, as a person reads one: the day and the minute. */
function when(at: number): string {
  return new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Who this browser is: the player and house it plays as, its sign-in, how that is kept and when it ends, and every
 * mail the game server sent, its links pressable, because in development nothing could deliver one.
 *
 * **Its one lever stands in for time, and for nothing a player does**: *let this sign-in run out* ends this browser's
 * sign-in now, as one left unused past its time does, and the window is stood down as a signed-out one. Signing out
 * and in are the player's, in the settings. All of it is Adam's instruments, since the outbox holds live links. See
 * decision record 0109.
 */
export function AccountsSection() {
  const me = useStore(meStore, (state) => state.me);
  const [mail, setMail] = useState<Mail[] | null>(null);

  const refresh = useCallback(() => {
    void whoAmI().catch(() => undefined);
    outbox().then(setMail, () => setMail(null));
  }, []);

  // On load and whenever the window is given focus, which is what coming back from a mail's link looks like.
  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  const signIn = me?.signIn ?? null;
  const reading = me === null ? 'asking' : me.player === null ? 'nobody' : me.guest ? 'a guest' : 'signed in';

  const letItRunOut = () => {
    void runOut().then(
      () => note('accounts', "this browser's sign-in has run out, as one left unused past its time does"),
      (refused: unknown) => note('accounts', `could not let the sign-in run out: ${String(refused)}`),
    );
  };

  return (
    <Section
      name="Accounts"
      reading={<span className="debug__quiet">{reading}</span>}
      tools={
        <button type="button" className="debug__button" onClick={refresh} title="ask the game server again">
          ask again
        </button>
      }
      about="Who this browser is signed in as, kept by a cookie no script can read, and the mail the game server sent. The lever stands in for time."
    >
      <dl className="debug__state">
        <div className="debug__row">
          <dt>player</dt>
          <dd>
            {me?.player === null || me === null
              ? 'nobody'
              : `${shortId(me.player)}, house ${shortId(me.house ?? '')}`}
          </dd>
        </div>
        {signIn !== null && (
          <>
            <div className="debug__row">
              <dt>sign-in</dt>
              <dd>
                {KEPT[signIn.keeping]}, in {signIn.browser}
              </dd>
            </div>
            <div className="debug__row">
              <dt>ends</dt>
              <dd>{when(signIn.ends)}, unless it is used again first</dd>
            </div>
          </>
        )}
      </dl>
      <div className="debug__levers">
        <button
          type="button"
          className="debug__button"
          disabled={signIn === null}
          title="end this browser's sign-in now, as one left unused past its time does"
          onClick={letItRunOut}
        >
          let this sign-in run out
        </button>
      </div>
      <p className="debug__quiet">
        {mail === null
          ? 'the outbox could not be read'
          : mail.length === 0
            ? 'the outbox is empty'
            : 'the outbox, the newest last'}
      </p>
      {mail !== null && mail.length > 0 && (
        <ul className="accounts__outbox" aria-label="the mail the game server sent">
          {mail.map((one) => (
            <li key={`${one.sent}:${one.to}:${one.subject}`}>
              <span className="debug__when">{when(one.sent)}</span> to {one.to}: {one.subject}
              {one.link !== null && (
                <>
                  {' '}
                  <a href={one.link}>open its link</a>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
