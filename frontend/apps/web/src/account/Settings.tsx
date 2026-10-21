import './settings.css';

import { useState } from 'react';

import { note } from '../log/log';
import { meStore, settle, signOut } from '../net/auth';
import type { Settings as Kept } from '../net/auth';
import type { Motion } from '../motion/motion';
import { useStore } from '../store/useStore';
import { MarkButton, TextButton } from '../ui/button/Button';
import { Choice } from '../ui/choice/Choice';
import { Dialog } from '../ui/dialog/Dialog';
import { Dropdown } from '../ui/field/Dropdown';
import { AccountPart } from './AccountPart';
import { CreateAccountForm, SignInForm } from './Forms';
import { ChangePasswordForm } from './PasswordForms';

const MOTIONS: readonly { id: Motion; label: string }[] = [
  { id: 'device', label: 'As my device asks' },
  { id: 'still', label: 'Still' },
  { id: 'moving', label: 'Moving' },
];

/** What the settings' dialog is showing: the settings, or one of the two ways to an account. */
type View = 'settings' | 'create' | 'signIn' | 'password';

const TITLES: Record<View, string> = {
  settings: 'Settings',
  create: 'Create an account',
  signIn: 'Sign in',
  password: 'Change the password',
};

/**
 * The settings that are not the game's, behind their mark, a gear, in the stage's top right corner: who this browser
 * plays as and the ways to an account, whether the world moves, the language, and for an account, logging out. In
 * the library's dialog rather than a pane, because none of it is the game, and put away by Escape, its close mark or
 * a press beside it. What is chosen is kept for the player by the server, so it follows an account to another
 * browser. See docs/plans/accounts.md.
 */
export function Settings() {
  const [open, setOpen] = useState(false);
  const [view, show] = useState<View>('settings');
  const me = useStore(meStore, (state) => state.me);
  const kept: Kept = me?.settings ?? { motion: 'device', language: 'en' };
  const signedIn = me !== null && me.player !== null;

  const close = () => {
    setOpen(false);
    show('settings');
  };

  const change = (settings: Kept) => {
    void settle(settings).then(
      () =>
        note(
          'accounts',
          `settings kept: the world ${settings.motion === 'device' ? 'moving as the device asks' : settings.motion}`,
        ),
      (refused: unknown) => note('accounts', `could not keep the settings: ${String(refused)}`),
    );
  };

  const logOut = () => {
    close();
    void signOut().then(
      () => note('accounts', 'signed out of this browser'),
      (refused: unknown) => note('accounts', `could not sign out: ${String(refused)}`),
    );
  };

  const actions =
    view !== 'settings' ? undefined : (
      <>
        {signedIn && !me.guest && (
          <TextButton face="secondary" onClick={logOut}>
            Log out
          </TextButton>
        )}
        <TextButton onClick={close}>Done</TextButton>
      </>
    );

  return (
    <>
      <MarkButton label="Settings" mark="settings" onClick={() => setOpen(true)} />
      <Dialog open={open} onClose={close} title={TITLES[view]} actions={actions}>
        {view === 'create' && <CreateAccountForm onElsewhere={() => show('signIn')} />}
        {view === 'signIn' && <SignInForm onElsewhere={() => show('create')} />}
        {view === 'password' && <ChangePasswordForm onBack={() => show('settings')} />}
        {view === 'settings' && (
          <>
            <AccountPart
              me={me}
              onCreate={() => show('create')}
              onSignIn={() => show('signIn')}
              onPassword={() => show('password')}
            />
            <section className="settings__part" aria-label="The world moving">
              <h3 className="ui-caps settings__title">The world moving</h3>
              <p className="ui-label">The clouds, the water, the creatures and the trees in the wind.</p>
              <Choice
                label="How the world moves"
                options={MOTIONS}
                chosen={kept.motion}
                onChoose={(motion) => signedIn && change({ ...kept, motion: motion as Motion })}
              />
            </section>
            <section className="settings__part" aria-label="Language">
              <Dropdown
                label="Language"
                options={[{ id: 'en', label: 'English' }]}
                chosen={kept.language}
                onChoose={() => undefined}
                hint="The only one for now: the game's words are not translated yet."
              />
            </section>
          </>
        )}
      </Dialog>
    </>
  );
}
