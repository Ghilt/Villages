import { useState } from 'react';

import { note } from '../log/log';
import { makeAccount, signInWith } from '../net/auth';
import { sessionStore } from '../net/gateway';
import { useStore } from '../store/useStore';
import { TextButton } from '../ui/button/Button';
import { TextField } from '../ui/field/TextField';
import { Form } from '../ui/form/Form';
import { Switch } from '../ui/switch/Switch';
import { Elsewhere } from './Elsewhere';
import { ForgotForm } from './PasswordForms';
import { aboutThePassword, said } from './words';

/** What a form is doing: waiting to be filled, being sent, or what came back from sending it. */
type Sending =
  { at: 'filling' } | { at: 'sending' } | { at: 'refused'; refusal: unknown } | { at: 'mailed'; to: string };

/** The name of this guest's house, if it has one, which signing in to an account leaves behind. */
function useGuestHouse(): string | null {
  return useStore(sessionStore, (state) => state.yourHouse?.house.name ?? null);
}

/** The email and the password a form asks for, the one it is refused about, and what it says under each. */
function Fields({
  email,
  setEmail,
  password,
  setPassword,
  remembered,
  remember,
  sending,
  choosing,
}: {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  remembered: boolean;
  remember: (on: boolean) => void;
  sending: Sending;
  /** A new password, which a password manager offers to make, rather than one it fills. */
  choosing: boolean;
}) {
  const refused = sending.at === 'refused' ? sending.refusal : undefined;
  const busy = sending.at === 'sending';
  return (
    <>
      <TextField
        kind="email"
        autoComplete="username"
        label="Email"
        value={email}
        onChange={setEmail}
        problem={refused !== undefined && !aboutThePassword(refused) ? said(refused) : null}
        disabled={busy}
      />
      <TextField
        kind="password"
        autoComplete={choosing ? 'new-password' : 'current-password'}
        label="Password"
        value={password}
        onChange={setPassword}
        hint={choosing ? 'Twelve letters or more. A phrase is easier to remember than symbols.' : undefined}
        problem={refused !== undefined && aboutThePassword(refused) ? said(refused) : null}
        disabled={busy}
      />
      <Switch
        label="Remember me on this browser"
        on={remembered}
        onChange={remember}
        say={null}
        disabled={busy}
      />
    </>
  );
}

/**
 * Making an account: an email, a new password and whether to be remembered. A guest's own player becomes it, house and
 * all; the page loads again as it. An email that has an account already is mailed to say so, and the form says a mail
 * is on its way.
 */
export function CreateAccountForm({ onElsewhere }: { onElsewhere: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remembered, remember] = useState(true);
  const [sending, send] = useState<Sending>({ at: 'filling' });

  const create = () => {
    send({ at: 'sending' });
    makeAccount(email, password, remembered).then(
      (me) => {
        if (me.email !== null && me.email === email.trim().toLowerCase()) {
          note('accounts', `an account made for ${me.email}; loading again as it`);
          window.location.reload();
          return;
        }
        send({ at: 'mailed', to: email.trim() });
      },
      (refusal: unknown) => send({ at: 'refused', refusal }),
    );
  };

  if (sending.at === 'mailed') {
    return (
      <p className="ui-body">
        A mail is on its way to {sending.to}: that address has an account already. Sign in with it instead.
      </p>
    );
  }
  return (
    <>
      <Form
        label="Create an account"
        onSend={create}
        actions={
          <>
            <TextButton face="secondary" onClick={onElsewhere}>
              Sign in instead
            </TextButton>
            <TextButton sends disabled={sending.at === 'sending'}>
              Create the account
            </TextButton>
          </>
        }
      >
        <p className="ui-label">
          An account keeps your house wherever you sign in. Its email will be asked to be verified.
        </p>
        <Fields {...{ email, setEmail, password, setPassword, remembered, remember, sending }} choosing />
      </Form>
      <Elsewhere />
    </>
  );
}

/**
 * Signing in with an email and a password, and whether to be remembered. Whatever this browser played as before is
 * left: a guest's house stays behind with it, which the form says first. The page loads again as the account.
 */
export function SignInForm({ onElsewhere }: { onElsewhere?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remembered, remember] = useState(true);
  const [sending, send] = useState<Sending>({ at: 'filling' });
  const [forgetting, forget] = useState(false);
  const house = useGuestHouse();

  const enter = () => {
    send({ at: 'sending' });
    signInWith(email, password, remembered).then(
      (me) => {
        note('accounts', `signed in as ${me.email ?? 'an account'}; loading again as it`);
        window.location.reload();
      },
      (refusal: unknown) => send({ at: 'refused', refusal }),
    );
  };

  if (forgetting) {
    return <ForgotForm onBack={() => forget(false)} />;
  }
  return (
    <>
      <Form
        label="Sign in"
        onSend={enter}
        actions={
          <>
            {onElsewhere !== undefined && (
              <TextButton face="secondary" onClick={onElsewhere}>
                Create an account
              </TextButton>
            )}
            <TextButton sends disabled={sending.at === 'sending'}>
              Sign in
            </TextButton>
          </>
        }
      >
        {house !== null && (
          <p className="ui-label">
            Signing in to an account leaves this guest’s house, {house}, behind: an account plays its own.
          </p>
        )}
        <Fields
          {...{ email, setEmail, password, setPassword, remembered, remember, sending }}
          choosing={false}
        />
        <div className="settings__row">
          <TextButton face="secondary" size="small" onClick={() => forget(true)}>
            Forgot your password?
          </TextButton>
        </div>
      </Form>
      <Elsewhere />
    </>
  );
}
