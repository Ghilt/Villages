import { describe, expect, it } from 'vitest';

import { ALL_TOKENS } from './tokens';
import css from './ui.css?raw';

/** The custom properties the stylesheet declares on `:root`, which are the tokens and nothing else. */
function declaredOnRoot(stylesheet: string): string[] {
  const root = /:root\s*\{([^}]*)\}/.exec(stylesheet);
  if (root === null) {
    throw new Error('ui.css declares no :root block');
  }
  return [...root[1]!.matchAll(/--(ui-[a-z0-9-]+)\s*:/g)].map((match) => match[1]!);
}

describe('the tokens', () => {
  it('are the ones the stylesheet declares, no more and no fewer', () => {
    const listed = ALL_TOKENS.map((token) => token.name).sort();
    expect(declaredOnRoot(css).sort()).toEqual(listed);
  });

  it('are each listed once', () => {
    const names = ALL_TOKENS.map((token) => token.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('each say what they are for', () => {
    for (const token of ALL_TOKENS) {
      expect(token.for.trim(), token.name).not.toBe('');
    }
  });
});
