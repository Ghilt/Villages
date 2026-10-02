import { describe, expect, it } from 'vitest';

import { Waiting } from './waiting';

describe('cells waiting on a tile', () => {
  it('tells every cell that waited on a tile, not just the first', () => {
    const waiting = new Waiting();
    const told: string[] = [];
    waiting.on(7, 'first', () => told.push('first'));
    waiting.on(7, 'second', () => told.push('second'));
    waiting.on(7, 'third', () => told.push('third'));
    expect(waiting.cells).toBe(3);

    waiting.came(7);
    expect(told).toEqual(['first', 'second', 'third']);
    expect(waiting.cells).toBe(0);

    // And once told, it is told no more.
    waiting.came(7);
    expect(told).toHaveLength(3);
  });

  it('tells a cell asked for again once, however many times it asked', () => {
    const waiting = new Waiting();
    let told = 0;
    for (let frame = 0; frame < 5; frame += 1) {
      waiting.on(7, 'cell', () => (told += 1));
    }
    waiting.came(7);
    expect(told).toBe(1);
  });

  it('counts a cell waiting on two tiles once, and tells it as each comes', () => {
    const waiting = new Waiting();
    let told = 0;
    waiting.on(7, 'cell', () => (told += 1));
    waiting.on(8, 'cell', () => (told += 1));
    expect(waiting.cells).toBe(1);

    waiting.came(8);
    expect(told).toBe(1);
    expect(waiting.cells).toBe(1);
    waiting.came(7);
    expect(told).toBe(2);
  });

  it('stops waiting on a tile that is not coming', () => {
    const waiting = new Waiting();
    const told: string[] = [];
    waiting.on(7, 'kept', () => told.push('kept'));
    waiting.on(9, 'dropped', () => told.push('dropped'));

    waiting.keepOnly((tile) => tile === 7);
    expect(waiting.cells).toBe(1);
    waiting.came(9);
    waiting.came(7);
    expect(told).toEqual(['kept']);
  });
});
