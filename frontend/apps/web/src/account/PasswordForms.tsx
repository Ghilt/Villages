import { useState } from 'react';

import { note } from '../log/log';
import { changePassword, forgotPassword, resetPassword } from '../net/auth';
import { TextButton } from '../ui/button/Button';
import { TextField } from '../ui/field/TextField';
import { Form } from '../ui/form/Form';
import { Switch } from '../ui/switch/Switch';
import { aboutThePassword, said } from './words';

/** What a form is doing: waiting, being sent, refused, or done. */
type Sending = { at: 'filling' } | { at: 'sending' } | { at: 'refused'; refusal: unknown } | { at: 'done' };

const HINT = 'Twelve letters or more. A phrase is easier to remember than symbols.';

/**
 * A forgotten password: an email, and a link to choose a new one mailed to it if it has an account. The answer is
 * the same whether it has one or not, so the form says nothing of who plays.
 */
export function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [sending, send] = useState<Sending>({ at: 'filling' });

  const ask = () => {
    send({ at: 'sending' });
    forgotPassword(email).then(
      () => send({ at: 'done' }),
      (refusal: unknown) => send({ at: 'refused', refusal }),
    );
  };

  if (sending.at === 'done') {
    return (
      <>
        <p className="ui-body">
          If an account has the email {email.trim()}, a link to choose a new password is on its way to it. It
          works for an hour.
        </p>
        <div className="settings__row">
          <TextButton face="secondary" onClick={onBack}>
            Back to signing in
          </TextButton>
        </div>
      </>
    );
  }
  return (
    <Form
      label="Forgotten password"
      onSend={ask}
      actions={
        <>
          <TextButton face="secondary" onClick={onBack}>
            Back
          </TextButton>
          <TextButton sends disabled={sending.at === 'sending'}>
            Mail me a link
          </TextButton>
        </>
      }
    >
      <p className="ui-label">A link to choose a new password is mailed to the account’s email.</p>
      <TextField
        kind="email"
        autoComplete="username"
        label="Email"
        value={email}
        onChange={setEmail}
        problem={sending.at === 'refused' ? said(sending.refusal) : null}
      />
    </Form>
  );
}

/**
 * Changing an account's password: the one it has and the one it is to have. Every other browser signed in to the
 * account is signed out, and the page loads again, signed in with a new secret.
 */
export function ChangePasswordForm({ onBack }: { onBack: () => void }) {
  const [was, setWas] = useState('');
  const [password, setPassword] = useState('');
  const [sending, send] = useState<Sending>({ at: 'filling' });
  const refused = sending.at === 'refused' ? sending.refusal : undefined;
  const aboutTheOld = refused instanceof Error && ['notThatPassword', 'tooMany'].includes(refused.message);

  const change = () => {
    send({ at: 'sending' });
    changePassword(was, password).then(
      () => {
        note('accounts', 'the password is changed, and every other browser signed out; loading again');
        window.location.reload();
      },
      (refusal: unknown) => send({ at: 'refused', refusal }),
    );
  };

  return (
    <Form
      label="Change the password"
      onSend={change}
      actions={
        <>
          <TextButton face="secondary" onClick={onBack}>
            Back
          </TextButton>
          <TextButton sends disabled={sending.at === 'sending'}>
            Change it
          </TextButton>
        </>
      }
    >
      <p className="ui-label">Every other browser signed in to the account is signed out.</p>
      <TextField
        kind="password"
        autoComplete="current-password"
        label="The password it has"
        value={was}
        onChange={setWas}
        problem={refused !== undefined && aboutTheOld ? said(refused) : null}
      />
      <TextField
        kind="password"
        autoComplete="new-password"
        label="A new password"
        value={password}
        onChange={setPassword}
        hint={HINT}
        problem={refused !== undefined && !aboutTheOld ? said(refused) : null}
      />
    </Form>
  );
}

/**
 * Choosing a new password through a mailed link's [secret], on the page the link opened: every browser signed in to
 * the account is signed out, and this one signed in to it, remembered unless unticked.
 */
export function ResetForm({ secret }: { secret: string }) {
  const [password, setPassword] = useState('');
  const [remembered, remember] = useState(true);
  const [sending, send] = useState<Sending>({ at: 'filling' });
  const refused = sending.at === 'refused' ? sending.refusal : undefined;

  const choose = () => {
    send({ at: 'sending' });
    resetPassword(secret, password, remembered).then(
      () => send({ at: 'done' }),
      (refusal: unknown) => send({ at: 'refused', refusal }),
    );
  };

  if (sending.at === 'done') {
    return (
      <>
        <p className="ui-body">
          The new password is kept, every browser that was signed in to the account is signed out, and this
          one is signed in.
        </p>
        <div className="settings__row">
          <TextButton onClick={() => window.location.assign('/')}>Go to the game</TextButton>
        </div>
      </>
    );
  }
  return (
    <Form
      label="Choose a new password"
      onSend={choose}
      actions={
        <TextButton sends disabled={sending.at === 'sending'}>
          Keep it
        </TextButton>
      }
    >
      <TextField
        kind="password"
        autoComplete="new-password"
        label="A new password"
        value={password}
        onChange={setPassword}
        hint={HINT}
        problem={refused !== undefined && aboutThePassword(refused) ? said(refused) : null}
      />
      {refused !== undefined && !aboutThePassword(refused) && <p className="ui-label">{said(refused)}</p>}
      <Switch label="Remember me on this browser" on={remembered} onChange={remember} say={null} />
    </Form>
  );
}
