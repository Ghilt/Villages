import { useEffect, useState } from 'react';

import { providers, signInThrough } from '../net/auth';
import { ProviderButton } from '../ui/provider/ProviderButton';

/**
 * Signing in through Google or Discord instead, each that this game server signs in through, in the forms under the
 * email and the password: away to the provider and back, signed in, remembered. On a tree they are pretend ones,
 * which say so on their page. A guest's house is kept by an identity that has no account here yet. See
 * docs/plans/accounts.md.
 */
export function Elsewhere() {
  const [offered, offer] = useState<('google' | 'discord')[]>([]);
  useEffect(() => {
    providers().then(
      (answer) => offer(answer.providers),
      () => offer([]),
    );
  }, []);

  if (offered.length === 0) return null;
  return (
    <div className="settings__elsewhere">
      <p className="ui-label">Or</p>
      {offered.map((provider) => (
        <ProviderButton key={provider} provider={provider} onClick={() => signInThrough(provider)} />
      ))}
    </div>
  );
}
