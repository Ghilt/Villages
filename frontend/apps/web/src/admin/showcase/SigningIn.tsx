import './signingIn.css';

import { useState } from 'react';

import { TextButton } from '../../ui/button/Button';
import type { Showing } from '../../ui/button/Button';
import { TextField } from '../../ui/field/TextField';
import { Form } from '../../ui/form/Form';
import { ProviderButton } from '../../ui/provider/ProviderButton';
import type { Provider } from '../../ui/provider/ProviderButton';
import { Switch } from '../../ui/switch/Switch';
import { Part, Specimen, Specimens } from './Specimen';

/** An email as the field says what is wrong with one, in the game's words rather than the browser's. */
function problemOf(email: string): string | null {
  return email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : 'That is not an email address.';
}

const STATES: readonly (Showing | 'disabled' | 'at rest')[] = [
  'at rest',
  'hover',
  'pressed',
  'focus',
  'disabled',
];

/**
 * The parts a player signs in with: a field for an email and one for a password, which a browser's password manager
 * fills and offers to save, the form they stand in, sent by its button or by Enter, and Google's and Discord's
 * buttons, drawn by their own rules. See docs/plans/accounts.md.
 */
export function SigningIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remembered, remember] = useState(true);
  const [sent, setSent] = useState<string | null>(null);

  return (
    <>
      <Part title="Email and password">
        <p className="ui-label showcase__lead">
          An email and a password, each a field of its own kind: the password hidden until its eye is pressed,
          and both named for a browser to fill, so a password manager offers what it has saved.
        </p>
        <Specimens>
          <Specimen
            name={'TextField kind="email"'}
            note={['autoComplete="username"', 'what is wrong, in our words']}
          >
            <div className="showcase__field-small">
              <TextField
                kind="email"
                autoComplete="username"
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                problem={problemOf(email)}
              />
            </div>
          </Specimen>
          <Specimen
            name={'TextField kind="password"'}
            note={['autoComplete="current-password"', 'its eye shows it']}
          >
            <div className="showcase__field-small">
              <TextField
                kind="password"
                autoComplete="current-password"
                label="Password"
                value={password}
                onChange={setPassword}
              />
            </div>
          </Specimen>
          <Specimen
            name={'TextField kind="password"'}
            note={['autoComplete="new-password"', 'how it is to be chosen']}
          >
            <div className="showcase__field-small">
              <TextField
                kind="password"
                autoComplete="new-password"
                label="A new password"
                value="correct horse battery"
                onChange={() => undefined}
                hint="Twelve letters or more."
              />
            </div>
          </Specimen>
          <Specimen name={'TextField kind="password"'} note="disabled">
            <div className="showcase__field-small">
              <TextField
                kind="password"
                label="Password"
                value="hidden"
                onChange={() => undefined}
                disabled
              />
            </div>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="A form">
        <p className="ui-label showcase__lead">
          The fields one under another and the buttons under them, the one that sends it last; Enter in either
          field sends it too.{' '}
          <span className="showcase__said">{sent === null ? 'not sent' : `sent: ${sent}`}</span>
        </p>
        <Specimens>
          <Specimen name="Form" note={['sent by Sign in, or by Enter', 'a Switch for remember me']} wide>
            <div className="showcase__field-width">
              <Form
                label="Sign in"
                onSend={() =>
                  setSent(`${email === '' ? 'no email' : email}, ${remembered ? 'remembered' : 'for now'}`)
                }
                actions={
                  <>
                    <TextButton face="secondary" onClick={() => setSent('asked to make an account')}>
                      Create an account
                    </TextButton>
                    <TextButton sends>Sign in</TextButton>
                  </>
                }
              >
                <TextField
                  kind="email"
                  autoComplete="username"
                  label="Email"
                  value={email}
                  onChange={setEmail}
                />
                <TextField
                  kind="password"
                  autoComplete="current-password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                />
                <Switch label="Remember me" on={remembered} onChange={remember} say={null} />
              </Form>
            </div>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Google and Discord">
        <p className="ui-label showcase__lead">
          Signing in through Google or Discord, drawn as their own rules draw a sign-in button, so a player
          knows each at once: not painted, and not ours to choose a mark or words for.
        </p>
        {(['google', 'discord'] as const satisfies readonly Provider[]).map((provider) => (
          <Specimens key={provider}>
            {STATES.map((state) => (
              <Specimen key={state} name={`ProviderButton provider="${provider}"`} note={state}>
                <div className="showcase__provider-width">
                  <ProviderButton
                    provider={provider}
                    disabled={state === 'disabled'}
                    {...(state === 'disabled' || state === 'at rest' ? {} : { showing: state })}
                  />
                </div>
              </Specimen>
            ))}
          </Specimens>
        ))}
      </Part>
    </>
  );
}
