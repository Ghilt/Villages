import type { Me } from '../net/auth';
import { TextButton } from '../ui/button/Button';

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
