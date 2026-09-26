import { describe, expect, it } from 'vitest';

import { oneCutAtATime } from './artApi.ts';

describe('the dev server keeping the art cut', () => {
  it('tells the page about a cut that changed the atlas, and not about one that found nothing new', async () => {
    let atlas: string | null = null;
    let news = true;
    let told = 0;
    const cutAndSay = oneCutAtATime(
      async () => {
        if (news) {
          atlas = `${atlas ?? 'an atlas'}, cut again`;
        }
        return true;
      },
      () => atlas,
      () => (told += 1),
    );

    await cutAndSay('no art cut in this tree yet');
    expect(told).toBe(1);
    await cutAndSay('oak.webp was saved');
    expect(told).toBe(2);
    news = false;
    await cutAndSay('the server started');
    expect(told).toBe(2);
  });

  it('tells the page nothing about a cut that failed, whatever it left behind', async () => {
    let atlas: string | null = 'the atlas as it was';
    let told = 0;
    const cutAndSay = oneCutAtATime(
      async () => {
        atlas = 'half of another';
        return false;
      },
      () => atlas,
      () => (told += 1),
    );

    await cutAndSay('the server started');
    expect(told).toBe(0);
  });

  it('cuts once more after pictures are saved during a cut, however many of them', async () => {
    const reasons: string[] = [];
    const cutAndSay = oneCutAtATime(
      async (why) => {
        reasons.push(why);
        if (reasons.length === 1) {
          void cutAndSay('pine.png was saved');
          void cutAndSay('birch.jpg was saved');
          void cutAndSay('reed.jpg was saved');
        }
        return true;
      },
      () => null,
      () => {},
    );

    await cutAndSay('the server started');
    expect(reasons).toEqual(['the server started', 'saved again while cutting']);
  });
});
