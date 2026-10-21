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
import { DeletePart } from './DeletePart';
import { ChangePasswordForm } from './PasswordForms';
import { SignInsPart } from './SignInsPart';

const MOTIONS: readonly { id: Motion; label: string }[] = [
  { id: 'device', label: 'As my device asks' },
  { id: 'still', label: 'Still' },
  { id: 'moving', label: 'Moving' },
];

/** What the settings are showing: the settings themselves, one of the two ways to an account, or a new password. */
export type View = 'settings' | 'create' | 'signIn' | 'password';

export const TITLES: Record<View, string> = {
  settings: 'Settings',
  create: 'Create an account',
  signIn: 'Sign in',
  password: 'Change the password',
};

/** Whether this browser plays as an account, which is who has sign-ins and a log out: not a guest, and not nobody. */
export function useAnAccount(): boolean {
  const me = useStore(meStore, (state) => state.me);
  return me !== null && me.player !== null && !me.guest;
}

/** Logs this browser out, as the foot of the settings does, and says so in the log. */
export function logOut(): void {
  void signOut().then(
    () => note('accounts', 'signed out of this browser'),
    (refused: unknown) => note('accounts', `could not sign out: ${String(refused)}`),
  );
}

/**
 * The settings themselves, wherever they are drawn: in the spread's dialog, or in the pane below on a phone. Who this
 * browser plays as and the ways to an account, whether the world moves, and the language; or, in their place, the way
 * to an account or the password asked for. What is chosen is kept for the player by the server, so it follows an
 * account to another browser. [onLeave] is the settings going away, as deleting the account takes them.
 */
export function SettingsParts({
  view,
  show,
  onLeave,
}: {
  view: View;
  show: (view: View) => void;
  onLeave: () => void;
}) {
  const me = useStore(meStore, (state) => state.me);
  const kept: Kept = me?.settings ?? { motion: 'device', language: 'en' };
  const signedIn = me !== null && me.player !== null;
  const account = useAnAccount();

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

  if (view === 'create') {
    return <CreateAccountForm onElsewhere={() => show('signIn')} />;
  }
  if (view === 'signIn') {
    return <SignInForm onElsewhere={() => show('create')} />;
  }
  if (view === 'password') {
    return <ChangePasswordForm onBack={() => show('settings')} />;
  }
  return (
    <>
      <AccountPart
        me={me}
        onCreate={() => show('create')}
        onSignIn={() => show('signIn')}
        onPassword={() => show('password')}
      />
      {account && <SignInsPart />}
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
      {account && <DeletePart onDeleting={onLeave} />}
    </>
  );
}

/**
 * The settings that are not the game's in the spread, behind their mark, a gear, in the stage's top right corner: in
 * the library's dialog rather than a pane, because none of it is the game, and put away by Escape, its close mark or
 * a press beside it. On a phone they are a pane instead, `SettingsPane`, because a dialog over the whole window is the
 * desktop's size there: Adam's word of 2026-10-21. See docs/plans/accounts.md.
 */
export function Settings() {
  const [open, setOpen] = useState(false);
  const [view, show] = useState<View>('settings');
  const account = useAnAccount();

  const close = () => {
    setOpen(false);
    show('settings');
  };

  const actions =
    view !== 'settings' ? undefined : (
      <>
        {account && (
          <TextButton
            face="secondary"
            onClick={() => {
              close();
              logOut();
            }}
          >
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
        <SettingsParts view={view} show={show} onLeave={close} />
      </Dialog>
    </>
  );
}
