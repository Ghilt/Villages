import { describe, expect, it } from 'vitest';

import { MOST_CLEARINGS, clearingsFrom, packClearings } from './cloudClearings';

const icon = (x: number, y: number, size = 44, alpha = 1) => ({ x, y, size, alpha });

describe('the clearings round the marks', () => {
  it('leaves none where no mark is drawn', () => {
    expect(clearingsFrom([], 30, 1000, 800)).toEqual([]);
  });

  it('clears a mark whole and eases out beyond it', () => {
    expect(clearingsFrom([icon(300, 200)], 30, 1000, 800)).toEqual([{ x: 300, y: 200, whole: 22, gone: 52 }]);
  });

  it('gives a fading mark a smaller patch, and a faint one none', () => {
    const [half] = clearingsFrom([icon(300, 200, 44, 0.5)], 30, 1000, 800);
    expect(half).toEqual({ x: 300, y: 200, whole: 11, gone: 26 });
    expect(clearingsFrom([icon(300, 200, 44, 0.01)], 30, 1000, 800)).toEqual([]);
  });

  it('keeps the marks nearest the middle when there are more than the shader takes', () => {
    const icons = Array.from({ length: 40 }, (_, i) => icon(500 + i * 10, 400));
    const kept = clearingsFrom(icons, 30, 1000, 800);
    expect(kept).toHaveLength(MOST_CLEARINGS);
    expect(Math.max(...kept.map((one) => one.x))).toBe(500 + (MOST_CLEARINGS - 1) * 10);
  });

  it('does not care what order the marks came in', () => {
    const icons = [icon(100, 100), icon(900, 700), icon(480, 420)];
    expect(clearingsFrom([...icons].reverse(), 30, 1000, 800)).toEqual(clearingsFrom(icons, 30, 1000, 800));
  });

  it('lays them out four numbers each, the rest left empty', () => {
    const into = new Float32Array(MOST_CLEARINGS * 4).fill(9);
    const count = packClearings(clearingsFrom([icon(300, 200), icon(500, 400)], 30, 1000, 800), into);
    expect(count).toBe(2);
    expect([...into.slice(0, 8)]).toEqual([500, 400, 22, 52, 300, 200, 22, 52]);
    expect(into.slice(8).every((value) => value === 0)).toBe(true);
  });
});
