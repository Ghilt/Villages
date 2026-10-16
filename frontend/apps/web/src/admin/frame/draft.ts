/** Where a value is in a catalogue's JSON: `['types', 'castle', 'sightKm']`. The empty path is the whole file. */
export type Path = readonly (string | number)[];

export const keyOf = (path: Path) => JSON.stringify(path);

export const startsWith = (path: Path, prefix: Path) => prefix.every((step, at) => path[at] === step);

export function getAt(json: unknown, path: Path): unknown {
  return path.reduce<unknown>(
    (at, step) =>
      at !== null && typeof at === 'object' ? (at as Record<string | number, unknown>)[step] : undefined,
    json,
  );
}

/** [json] with [value] at [path], everything else shared rather than copied, and every field where it was. */
export function setAt(json: unknown, path: Path, value: unknown): unknown {
  const [step, ...rest] = path;
  if (step === undefined) return value;
  if (Array.isArray(json) && typeof step === 'number') {
    const copy: unknown[] = [...json];
    copy[step] = setAt(json[step], rest, value);
    return copy;
  }
  const held = (json !== null && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  return { ...held, [step]: setAt(held[step], rest, value) };
}
