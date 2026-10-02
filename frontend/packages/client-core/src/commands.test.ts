import { describe, expect, it } from 'vitest';

import { NOTHING_IN_FLIGHT, answered, canAct, goingOut } from './commands';
import type { Outgoing } from './commands';

const taking: Outgoing = {
  lane: 'player',
  area: 'command',
  what: 'taking "Skarnholt"',
  command: { type: 'takeAction', choiceId: 'c', optionId: 'o' },
};
const granting: Outgoing = {
  lane: 'lever',
  area: 'resources',
  what: 'granting 100 wealth',
  command: { type: 'grantResource', resource: 'wealth', amount: 100 },
};
const one = '11111111-0000-4000-8000-000000000000';
const two = '22222222-0000-4000-8000-000000000000';

describe('one way a command goes out', () => {
  it('sends a command as a frame, says it under where it was asked from, and holds the player to one at a time', () => {
    const first = goingOut(NOTHING_IN_FLIGHT, true, one, taking)!;

    expect(first.frame).toEqual({ type: 'command', commandId: one, command: taking.command });
    expect([first.area, first.line]).toEqual(['command', 'taking "Skarnholt" as 11111111']);
    expect(first.inFlight.acting).toBe(one);
    expect(goingOut(first.inFlight, true, two, taking)).toBe(null);
  });

  it('lets a lever go however busy the player is, and holds nothing for it', () => {
    const busy = goingOut(NOTHING_IN_FLIGHT, true, one, taking)!.inFlight;

    const pulled = goingOut(busy, true, two, granting)!;

    expect(pulled.inFlight.acting).toBe(one);
    expect(pulled.line).toBe('granting 100 wealth as 22222222');
  });

  it('sends nothing while the gateway is not listening', () => {
    expect(goingOut(NOTHING_IN_FLIGHT, false, one, taking)).toBe(null);
    expect(goingOut(NOTHING_IN_FLIGHT, false, two, granting)).toBe(null);
  });

  it("files an answer beside its asking, frees the player's lane, and files an answer to nothing as the gateway's", () => {
    const busy = goingOut(
      goingOut(NOTHING_IN_FLIGHT, true, one, taking)!.inFlight,
      true,
      two,
      granting,
    )!.inFlight;

    const lever = answered(busy, two);
    expect(lever.area).toBe('resources');
    expect(lever.inFlight.acting).toBe(one);

    const player = answered(lever.inFlight, one);
    expect(player.area).toBe('command');
    expect(player.inFlight).toEqual(NOTHING_IN_FLIGHT);

    expect(answered(player.inFlight, one).area).toBe('gateway');
  });

  it('lets the player act only when the gateway is listening and nothing of theirs is waiting', () => {
    expect(canAct({ connection: 'open', acting: null })).toBe(true);
    expect(canAct({ connection: 'open', acting: one })).toBe(false);
    expect(canAct({ connection: 'closed', acting: null })).toBe(false);
    expect(canAct({ connection: 'connecting', acting: null })).toBe(false);
  });
});
