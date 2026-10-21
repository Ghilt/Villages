import '../ui/ui.css';
import './linkPage.css';
import './settings.css';

import { useState } from 'react';

import { verifyEmail } from '../net/auth';
import { TextButton } from '../ui/button/Button';
import { DialogBox } from '../ui/dialog/Dialog';
import { ResetForm } from './PasswordForms';
import { said } from './words';

/** Where a press has got to: not pressed, being sent, done, or refused. */
type Pressed = { at: 'waiting' } | { at: 'sending' } | { at: 'done' } | { at: 'refused'; refusal: unknown };

/**
 * The page a mailed link opens, on its own and with nothing of the game behind it: the link's secret is after the `#`
 * of its address, which no server's log sees, and it is sent on only with a press, because mail scanners open links
 * before people do and a link that worked as it was opened would be used up by a scanner. See docs/plans/accounts.md.
 */
export function LinkPage({ path }: { path: string }) {
  const secret = window.location.hash.slice(1);
  const [pressed, press] = useState<Pressed>({ at: 'waiting' });

  if (secret !== '' && path === '/account/reset') {
    return (
      <main className="ui-root link-page">
        <DialogBox title="Choose a new password">
          <ResetForm secret={secret} />
        </DialogBox>
      </main>
    );
  }
  if (secret === '' || path !== '/account/verify') {
    return (
      <main className="ui-root link-page">
        <DialogBox
          title="Nothing to open"
          actions={<TextButton onClick={() => window.location.assign('/')}>Go to the game</TextButton>}
        >
          <p className="ui-body">
            This address is not a link the game mailed, or it lost its end on the way.
          </p>
        </DialogBox>
      </main>
    );
  }

  const verify = () => {
    press({ at: 'sending' });
    verifyEmail(secret).then(
      () => press({ at: 'done' }),
      (refusal: unknown) => press({ at: 'refused', refusal }),
    );
  };

  return (
    <main className="ui-root link-page">
      <DialogBox
        title={pressed.at === 'done' ? 'Your email is verified' : 'Verify your email'}
        actions={
          pressed.at === 'done' || pressed.at === 'refused' ? (
            <TextButton onClick={() => window.location.assign('/')}>Go to the game</TextButton>
          ) : (
            <TextButton onClick={verify} disabled={pressed.at === 'sending'}>
              Verify it
            </TextButton>
          )
        }
      >
        <p className="ui-body">
          {pressed.at === 'done'
            ? 'Thank you: the address is yours, and the account says so.'
            : pressed.at === 'refused'
              ? said(pressed.refusal)
              : 'Press to say that the address this was mailed to is yours.'}
        </p>
      </DialogBox>
    </main>
  );
}
