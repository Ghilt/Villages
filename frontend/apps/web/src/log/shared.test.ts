import { afterEach, describe, expect, it } from 'vitest';

import { note } from './log';
import { hearTheLog, shareTheLog } from './shared';
import type { LogMessage } from './shared';

/** Everything heard on the channel until [enough] of it has come, or a second has passed. */
function heardUntil(enough: (heard: LogMessage[]) => boolean): {
  done: Promise<LogMessage[]>;
  stop: () => void;
} {
  const heard: LogMessage[] = [];
  let settle: (heard: LogMessage[]) => void = () => {};
  const done = new Promise<LogMessage[]>((resolve) => (settle = resolve));
  const stop = hearTheLog((message) => {
    heard.push(message);
    if (enough(heard)) settle(heard);
  });
  setTimeout(() => settle(heard), 1000);
  return { done, stop };
}

const stops: (() => void)[] = [];
afterEach(() => stops.splice(0).forEach((stop) => stop()));

describe("a game window's log, shared", () => {
  it('answers the logs page with every note it holds, and says each new one', async () => {
    note('world', 'before the page opened');
    const sharing = shareTheLog('/', 'aaaa1111');
    stops.push(sharing);
    const listening = heardUntil((heard) => heard.some((message) => message.kind === 'note'));
    stops.push(listening.stop);
    // The answer to the ask comes first; a note made after it follows.
    await new Promise((resolve) => setTimeout(resolve, 50));
    note('cells', 'after the page opened');
    const heard = await listening.done;

    const answer = heard.find((message) => message.kind === 'notes');
    expect(answer).toMatchObject({ window: { id: 'aaaa1111', address: '/' } });
    expect(answer?.kind === 'notes' && answer.notes.map((one) => one.message)).toContain(
      'before the page opened',
    );
    expect(heard.find((message) => message.kind === 'note')).toMatchObject({
      window: { id: 'aaaa1111' },
      note: { area: 'cells', message: 'after the page opened' },
    });
  });

  it('says it is gone when it stops sharing', async () => {
    const sharing = shareTheLog('/', 'bbbb2222');
    const listening = heardUntil((heard) => heard.some((message) => message.kind === 'gone'));
    stops.push(listening.stop);
    await new Promise((resolve) => setTimeout(resolve, 50));
    sharing();
    const heard = await listening.done;
    expect(heard.find((message) => message.kind === 'gone')).toMatchObject({ window: { id: 'bbbb2222' } });
  });
});
