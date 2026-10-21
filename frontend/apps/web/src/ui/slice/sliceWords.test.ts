import { describe, expect, it } from 'vitest';

import { pipSaid, pipTitle } from './sliceWords';

describe('a pip', () => {
  it('says the first letter of what is borne and the seconds it has left', () => {
    expect(pipSaid({ name: 'Weakened', kind: 'debuff', seconds: 3 })).toBe('W 3');
  });

  it('says only the letter of one that lasts as long as the happening', () => {
    expect(pipSaid({ name: 'Empowered', kind: 'buff', seconds: null })).toBe('E');
  });

  it('leaves a leading article out of the letter', () => {
    expect(pipSaid({ name: 'the Curfew', kind: 'debuff', seconds: 2 })).toBe('C 2');
  });

  it('says its whole name in its tooltip, one second or many', () => {
    expect(pipTitle({ name: 'Weakened', kind: 'debuff', seconds: 1 })).toBe('Weakened, 1 second left');
    expect(pipTitle({ name: 'Hastened', kind: 'buff', seconds: 4 })).toBe('Hastened, 4 seconds left');
    expect(pipTitle({ name: 'Empowered', kind: 'buff', seconds: null })).toBe(
      'Empowered, while the happening lasts',
    );
  });
});
