import { useState } from 'react';

import { note } from '../log/log';
import { startOver } from '../net/auth';
import { sessionStore } from '../net/gateway';
import { useStore } from '../store/useStore';
import { TextButton } from '../ui/button/Button';
import { Dialog } from '../ui/dialog/Dialog';
import { SignInForm } from './Forms';

/**
 * What a window says once the browser's sign-in has ended: signed out here or from another browser, or left unused
 * past its time. The window is finished as a taken-over one is - it holds no cells and is sent nothing - so it has to
 * look finished, over everything, with nothing to put it away but an answer: signing in again, or playing on as a
 * guest, who is somebody new. See decision record 0109.
 */
export function SignedOut() {
  const connection = useStore(sessionStore, (state) => state.connection);
  const [signingIn, signIn] = useState(false);
  const asGuest = () => {
    void startOver().then(
      () => window.location.reload(),
      (refused: unknown) => note('accounts', `could not play as a guest: ${String(refused)}`),
    );
  };

  return (
    <Dialog
      open={connection === 'signedOut'}
      onClose={() => undefined}
      dismissable={false}
      title={signingIn ? 'Sign in' : 'Signed out'}
      actions={
        signingIn ? undefined : (
          <>
            <TextButton face="secondary" onClick={asGuest}>
              Play as a guest
            </TextButton>
            <TextButton onClick={() => signIn(true)}>Sign in</TextButton>
          </>
        )
      }
    >
      {signingIn ? (
        <SignInForm />
      ) : (
        <p className="ui-body">
          This browser is no longer signed in, so this window has stopped playing. It was signed out here or
          from another browser, or it went unused for longer than a sign-in lasts. A guest starts again as
          somebody new.
        </p>
      )}
    </Dialog>
  );
}
