import { useState } from 'react';

import { mailVerifyingAgain } from '../net/auth';
import type { Me } from '../net/auth';
import { TextButton } from '../ui/button/Button';
import { said } from './words';

/** Who this browser plays as, in a sentence. */
function whoSaid(me: Me | null): string {
  if (me === null) return 'Asking the game who this browser is…';
  if (me.player === null) return 'This browser is signed in to nobody.';
  if (me.guest) {
    return 'You are playing as a guest, remembered by this browser alone: clearing its cookies would lose your house. An account keeps it wherever you sign in.';
  }
  return `You are signed in as ${me.email ?? 'an account'}.`;
}

/**
 * The settings' Account part: who this browser plays as, and for a guest the two ways to an account - making one,
 * which keeps this guest's house, or signing in to one that exists. See docs/plans/accounts.md.
 */
export function AccountPart({
  me,
  onCreate,
  onSignIn,
}: {
  me: Me | null;
  onCreate: () => void;
  onSignIn: () => void;
}) {
  return (
    <section className="settings__part" aria-label="Account">
      <h3 className="ui-caps settings__title">Account</h3>
      <p className="ui-body">{whoSaid(me)}</p>
      {me !== null && !me.guest && !me.verified && <NotVerified email={me.email ?? ''} />}
      {me !== null && me.guest && (
        <div className="settings__row">
          <TextButton onClick={onCreate}>Create an account</TextButton>
          <TextButton face="secondary" onClick={onSignIn}>
            Sign in
          </TextButton>
        </div>
      )}
    </section>
  );
}

/**
 * An account whose email has not been verified yet: it plays and signs in all the same, and the link that verifies it
 * can be mailed again, the newest the only one that works.
 */
function NotVerified({ email }: { email: string }) {
  const [sent, send] = useState<string | null>(null);
  const again = () => {
    mailVerifyingAgain().then(
      () => send(`Mailed again to ${email}.`),
      (refusal: unknown) => send(said(refusal)),
    );
  };
  return (
    <>
      <p className="ui-label">Not verified yet: a link to verify it was mailed to {email}.</p>
      <div className="settings__row">
        <TextButton face="secondary" size="small" onClick={again}>
          Send it again
        </TextButton>
        {sent !== null && <span className="ui-label">{sent}</span>}
      </div>
    </>
  );
}
