/**
 * The names a newcomer can be given, `world/catalogues/character-names.json`, as the inspect page reads them: given
 * names by sex, and family names. Strict as the server's reader is: a list it cannot read refuses the file, naming
 * it. Held to the server's reader by `contracts/fixtures/character-names.json`. See decision record 0097.
 */

export interface CharacterNames {
  readonly woman: readonly string[];
  readonly man: readonly string[];
  readonly family: readonly string[];
  /** What the file says of itself. */
  readonly said: string;
}

type Node = Record<string, unknown>;

const isObject = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function names(value: unknown, at: string): string[] {
  if (!Array.isArray(value) || !value.every((one) => typeof one === 'string')) {
    throw new Error(`world/catalogues/character-names.json: no ${at} the page can read`);
  }
  return value as string[];
}

/** The names in `text`, or an error naming the first list that cannot be read. */
export function parseCharacterNames(text: string): CharacterNames {
  const file: unknown = JSON.parse(text);
  const given = isObject(file) && isObject(file.given) ? file.given : {};
  return {
    woman: names(given.woman, 'given.woman'),
    man: names(given.man, 'given.man'),
    family: names(isObject(file) ? file.family : undefined, 'family'),
    said: isObject(file) && typeof file.$comment === 'string' ? file.$comment : '',
  };
}
