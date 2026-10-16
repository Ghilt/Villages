import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CASTS, memberOf } from './casts';
import { CRITTERS_LOOK } from './look';

const world = (file: string) =>
  JSON.parse(readFileSync(new URL(`../../../../../../world/${file}`, import.meta.url), 'utf8')) as {
    classes?: { name: string }[];
    kinds?: { name: string }[];
  };
const CLASSES = world('palette.json').classes!.map((one) => one.name);
const SCENERY = world('biomes.json').kinds!.map((one) => one.name);
const CRITTERS = world('critters.json').kinds!.map((one) => one.name);

describe('the casts', () => {
  it('name only terrain classes, critters and scenery there are', () => {
    // A name spelt wrong would leave a cast quietly empty rather than failing anywhere else.
    expect(Object.keys(CASTS).filter((land) => !CLASSES.includes(land))).toEqual([]);
    const members = Object.values(CASTS).flat();
    expect(members.filter((member) => !CRITTERS.includes(member.kind)).map((m) => m.kind)).toEqual([]);
    expect(members.flatMap((member) => member.from).filter((kind) => !SCENERY.includes(kind))).toEqual([]);
  });

  it('give every critter they name a size to be drawn at', () => {
    const kinds = new Set(Object.values(CASTS).flatMap((cast) => cast.map((member) => member.kind)));
    expect([...kinds].filter((kind) => CRITTERS_LOOK.kinds[kind] === undefined)).toEqual([]);
  });

  it('pick a member by weight', () => {
    const cast = [
      { kind: 'songbird', behaviour: 'flush' as const, weight: 3, from: ['oak'] },
      { kind: 'hare', behaviour: 'flush' as const, weight: 1, from: ['oak'] },
    ];
    expect(memberOf(cast, 0.7)?.kind).toBe('songbird');
    expect(memberOf(cast, 0.8)?.kind).toBe('hare');
    expect(memberOf(undefined, 0.5)).toBeNull();
  });
});
