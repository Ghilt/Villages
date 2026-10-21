/**
 * What the account's refusals say to a player, by the code the game server refuses with: in the game's words, never
 * the browser's or a status number. A code nobody has words for yet is said as it is, so a gap shows rather than
 * hiding. See docs/plans/accounts.md.
 */
const SAID: Record<string, string> = {
  notAnEmail: 'That is not an email address.',
  short: 'A password is twelve letters or more.',
  long: 'A password is at most 128 letters.',
  common: 'That password is one of the commonest there are: choose another.',
  isTheEmail: 'A password cannot be your email.',
  notThatPassword: 'That email and password are not an account’s.',
  tooMany: 'Too many tries. Wait a quarter of an hour and try again.',
  notSignedIn: 'This browser is not signed in.',
};

/** What [refusal], thrown by `net/auth.ts`, says to a player. */
export function said(refusal: unknown): string {
  const code = refusal instanceof Error ? refusal.message : String(refusal);
  return SAID[code] ?? `The game refused: ${code}.`;
}

/** Whether [refusal] is about the password rather than the email, so it is said under the password's field. */
export function aboutThePassword(refusal: unknown): boolean {
  const code = refusal instanceof Error ? refusal.message : String(refusal);
  return ['short', 'long', 'common', 'isTheEmail', 'notThatPassword', 'tooMany'].includes(code);
}
