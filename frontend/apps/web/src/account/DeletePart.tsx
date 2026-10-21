import { note } from '../log/log';
import { deleteAccount } from '../net/auth';
import { HoldButton } from '../ui/hold/HoldButton';

/**
 * Deleting the account, held to confirm because it cannot be undone: its email, its password, its Google and Discord
 * identities, its settings and every sign-in of it go, and every window of it is signed out. The house stays in the
 * world with nobody to play it; what the world does with such a house is for later. See docs/plans/accounts.md.
 */
export function DeletePart({ onDeleting }: { onDeleting: () => void }) {
  const remove = () => {
    onDeleting();
    void deleteAccount().then(
      () => note('accounts', 'the account is deleted; its house stays in the world with nobody to play it'),
      (refused: unknown) => note('accounts', `could not delete the account: ${String(refused)}`),
    );
  };
  return (
    <section className="settings__part" aria-label="Delete my account">
      <h3 className="ui-caps settings__title">Delete my account</h3>
      <p className="ui-label">
        Your email, your password and every sign-in go for good. Your house stays in the world, with nobody to
        play it.
      </p>
      <div className="settings__row">
        <HoldButton face="secondary" size="small" onConfirm={remove}>
          Hold to delete my account
        </HoldButton>
      </div>
    </section>
  );
}
