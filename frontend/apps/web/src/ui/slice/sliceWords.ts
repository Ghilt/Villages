/** Whether a slice can work in the happening going on, as its chip says it. */
export type SliceState = 'matching' | 'answering' | 'working' | 'idle';

/** What a slice or a summon bears for a while: a buff or a debuff, and how many seconds it has left, if it ends. */
export interface Borne {
  readonly name: string;
  readonly kind: 'buff' | 'debuff';
  /** Seconds left; null for one that lasts as long as the happening. */
  readonly seconds: number | null;
}

/** What an effect needs of the happening to work. */
export type Need = 'match' | 'anti' | 'any';

/** The words a chip says under its aspect, until the caller says otherwise. */
export const STATE_WORDS: Record<SliceState, string> = {
  matching: 'matches',
  answering: 'answers its anti-aspect',
  working: 'working',
  idle: 'idle',
};

/** The words on an effect's need. */
export const NEED_WORDS: Record<Need, string> = {
  match: 'matching',
  anti: 'anti-aspect',
  any: 'any',
};

/** A pip's few letters: the name's first, and the seconds left when it ends. Its whole name is its tooltip. */
export function pipSaid(borne: Borne): string {
  const letter = borne.name
    .replace(/^(an?|the)\s+/i, '')
    .charAt(0)
    .toUpperCase();
  return borne.seconds === null ? letter : `${letter} ${borne.seconds}`;
}

/** A pip's tooltip: what it is, and how long it lasts. */
export function pipTitle(borne: Borne): string {
  if (borne.seconds === null) {
    return `${borne.name}, while the happening lasts`;
  }
  return `${borne.name}, ${borne.seconds} ${borne.seconds === 1 ? 'second' : 'seconds'} left`;
}
