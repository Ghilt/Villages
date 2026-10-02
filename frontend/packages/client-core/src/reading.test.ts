import { describe, expect, it } from 'vitest';

import type { DialogueView, LineView } from '@villages/protocol';

import { choose, keepReading, pressNext, showing, startReading } from './reading';

function line(id: string, speaker = 'messenger'): LineView {
  return { id, speaker, words: `The words of ${id}.` };
}

/** The letter as the server sends it at each of its revisions: offered, an option taken, finished. */
function letter(over: Partial<DialogueView> = {}): DialogueView {
  return {
    id: 'dd000000-0000-4000-8000-00000000a001',
    revision: 1,
    title: 'A letter from the coast',
    speakers: [
      { id: 'figure', party: 0, name: 'Agnes Hollin', character: 'cb732500' },
      { id: 'messenger', party: 1, name: 'A messenger' },
    ],
    said: [],
    next: [line('arrives'), line('reads', 'figure')],
    options: [line('accept', 'figure'), line('ask', 'figure'), line('refuse', 'figure')],
    ending: { kind: 'open' },
    ...over,
  };
}

const accepted = letter({
  revision: 2,
  said: ['arrives', 'reads', 'accept'].map((id) => ({ ...line(id), effects: [] })),
  next: [line('paid')],
  options: [],
});

const ids = (lines: readonly LineView[]) => lines.map((one) => one.id);

describe('reading a dialogue', () => {
  it('starts at the first line of the stretch, with next to press', () => {
    const reading = startReading(letter());

    expect(ids(showing(reading, letter()).lines)).toEqual(['arrives']);
    expect(showing(reading, letter()).next).toBe(true);
    expect(showing(reading, letter()).options).toEqual([]);
  });

  it('shows the stretch a line at a time, then the options, and then has nothing for next to do', () => {
    const pressed = pressNext(startReading(letter()), letter(), false);
    if (pressed?.kind !== 'show') {
      throw new Error('next should have shown a line');
    }

    const now = showing(pressed.reading, letter());
    expect(ids(now.lines)).toEqual(['arrives', 'reads']);
    expect(now.next).toBe(false);
    expect(ids(now.options)).toEqual(['accept', 'ask', 'refuse']);
    expect(pressNext(pressed.reading, letter(), false)).toBeNull();
  });

  it('takes an option only once the options are showing', () => {
    const reading = startReading(letter());

    expect(choose(reading, letter(), 'accept', false)).toBeNull();
    expect(choose({ ...reading, shown: 2 }, letter(), 'accept', false)).toEqual({
      kind: 'step',
      line: line('accept', 'figure'),
    });
    expect(choose({ ...reading, shown: 2 }, letter(), 'not an option', false)).toBeNull();
  });

  // The step a stretch ends in is sent by moving past its last line, which is how a line that pays is reached.
  it('sends the step the stretch ends in, when no dialogue choice follows it', () => {
    const reading = startReading(accepted);

    expect(ids(showing(reading, accepted).lines)).toEqual(['paid']);
    expect(showing(reading, accepted).next).toBe(true);
    expect(pressNext(reading, accepted, false)).toEqual({ kind: 'step', line: line('paid') });
  });

  it('presses nothing while a step is out', () => {
    expect(pressNext(startReading(letter()), letter(), true)).toBeNull();
    expect(choose({ ...startReading(letter()), shown: 2 }, letter(), 'accept', true)).toBeNull();
  });

  it('shows the options at once when a dialogue choice follows a step straight away', () => {
    const choosing = letter({ next: [], options: [line('yes', 'figure'), line('no', 'figure')] });
    const reading = startReading(choosing);

    expect(showing(reading, choosing).lines).toEqual([]);
    expect(showing(reading, choosing).next).toBe(false);
    expect(ids(showing(reading, choosing).options)).toEqual(['yes', 'no']);
  });

  it('shows nothing more of a dialogue that has ended, and has nothing to press', () => {
    const lost = letter({ ending: { kind: 'lost', because: { kind: 'alive', character: 'cb732500' } } });
    const reading = startReading(lost);

    expect(showing(reading, lost)).toEqual({ lines: [line('arrives')], next: false, options: [] });
    expect(pressNext(reading, lost, false)).toBeNull();
  });
});

describe('keeping the place', () => {
  it('keeps it while the revision holds, the very same place', () => {
    const reading = { ...startReading(letter()), shown: 2 };

    expect(keepReading(reading, letter())).toBe(reading);
  });

  // A step taken, here or in another window, is a new stretch, and a reload is a new page: both start over.
  it('starts the new stretch from its first line when the dialogue has moved on', () => {
    const reading = { ...startReading(letter()), shown: 2 };

    expect(keepReading(reading, accepted)).toEqual({ dialogueId: accepted.id, revision: 2, shown: 1 });
    expect(keepReading(null, accepted)).toEqual(startReading(accepted));
  });

  it('starts over for another dialogue', () => {
    const other = letter({ id: 'dd000000-0000-4000-8000-00000000a002' });

    expect(keepReading({ ...startReading(letter()), shown: 2 }, other)).toEqual(startReading(other));
  });
});
