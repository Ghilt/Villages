import { describe, expect, it } from 'vitest';

import { tellAbout } from './about.ts';

const rhine = { name: 'Rhine', ids: ['ne:105:Rhein', 'ne:150:Rhine'], about: 'Out of the Alps to Holland.' };
const baltic = { name: 'Baltic Sea', ids: ['Q545'], about: 'The East Sea of the Swedes.' };

describe('the lines about the rivers, lakes and seas', () => {
  it('give every carried piece of a thing its one line, and leave a thing with none as it was', () => {
    const told = tellAbout(
      { rivers: [rhine], seas: [baltic] },
      [{ id: 'ne:105:Rhein' }, { id: 'ne:150:Rhine' }, { id: 'Q548' }],
      [{ id: 'Q545', kind: 'sea' }],
    );

    expect(told.names).toEqual([
      { id: 'ne:105:Rhein', about: 'Out of the Alps to Holland.' },
      { id: 'ne:150:Rhine', about: 'Out of the Alps to Holland.' },
      { id: 'Q548' },
    ]);
    expect(told.regions).toEqual([{ id: 'Q545', kind: 'sea', about: 'The East Sea of the Swedes.' }]);
    expect(told.given).toBe(3);
    expect(told.absent).toEqual([]);
  });

  it('say which ids this world does not carry, rather than refusing the file', () => {
    const told = tellAbout({ rivers: [rhine] }, [{ id: 'ne:105:Rhein' }], []);

    expect(told.given).toBe(1);
    expect(told.absent).toEqual(['ne:150:Rhine']);
    expect(tellAbout({}, [{ id: 'Q548' }], []).names).toEqual([{ id: 'Q548' }]);
  });
});
