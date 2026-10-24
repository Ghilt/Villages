import { describe, expect, it } from 'vitest';

import { momentOf } from './strike';

const strikeOn = (width: number, height: number) => ({
  key: 'a strike',
  from: { x: 0, y: 0 },
  to: { x: 300, y: 200, width, height },
  colour: 'gold',
});

describe('a strike crackling round what it reached', () => {
  it('crackles more round a pane than round a slice, along its long edges', () => {
    const slice = momentOf('leader', strikeOn(100, 24), 500).lights.length;
    const pane = momentOf('leader', strikeOn(320, 240), 500).lights.length;
    expect(pane).toBeGreaterThan(slice);
  });
});
