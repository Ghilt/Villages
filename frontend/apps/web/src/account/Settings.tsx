import './settings.css';

import { useState } from 'react';

import { note } from '../log/log';
import { meStore, settle } from '../net/auth';
import type { Me, Settings as Kept } from '../net/auth';
import type { Motion } from '../motion/motion';
import { useStore } from '../store/useStore';
import { MarkButton, TextButton } from '../ui/button/Button';
import { Choice } from '../ui/choice/Choice';
import { Dialog } from '../ui/dialog/Dialog';
import { Dropdown } from '../ui/field/Dropdown';

const MOTIONS: readonly { id: Motion; label: string }[] = [
  { id: 'device', label: 'As my device asks' },
  { id: 'still', label: 'Still' },
  { id: 'moving', label: 'Moving' },
];

/** Who this browser plays as, in a sentence: a guest, for now, until there are accounts to sign in to. */
function whoSaid(me: Me | null): string {
  if (me === null) return 'Asking the game who this browser is…';
  if (me.player === null) return 'This browser is signed in to nobody.';
  return me.guest
    ? 'You are playing as a guest, remembered by this browser. Clearing its cookies would lose your house.'
    : 'You are signed in.';
}

/**
 * The settings that are not the game's, behind their mark, a gear, in the stage's top right corner: who this browser
 * plays as, whether the world moves, and the language. In the library's dialog rather than a pane, because none of
 * it is the game, and put away by Escape, its close mark or a press beside it. What is chosen is kept for the player
 * by the server, so it follows an account to another browser. See docs/plans/accounts.md.
 */
export function Settings() {
  const [open, setOpen] = useState(false);
  const me = useStore(meStore, (state) => state.me);
  const kept: Kept = me?.settings ?? { motion: 'device', language: 'en' };
  const signedIn = me?.player !== null && me !== null;

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

  return (
    <>
      <MarkButton label="Settings" mark="settings" onClick={() => setOpen(true)} />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Settings"
        actions={<TextButton onClick={() => setOpen(false)}>Done</TextButton>}
      >
        <section className="settings__part" aria-label="Account">
          <h3 className="ui-caps settings__title">Account</h3>
          <p className="ui-body">{whoSaid(me)}</p>
        </section>
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
      </Dialog>
    </>
  );
}
