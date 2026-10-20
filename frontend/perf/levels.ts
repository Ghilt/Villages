import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Where a tree keeps the level of each of its shaders, found in its source rather than listed here, because the
 * modules move and are renamed from one commit to the next (`sprites/grass/grassMode.ts`'s `setGrassLevel` became
 * `sprites/land/landMode.ts`'s `setLandLevel`). A shader's level is set by a function `set<Name>Level(level:
 * ShaderLevel)` and read from the store beside it named for the same thing. The page is handed each as the module's
 * address on the dev server, `/src/...`, which imports the very module the game imported.
 */
export interface LevelSetter {
  /** The module's address on the dev server. */
  readonly module: string;
  readonly setter: string;
  /** The store its level is read from, when one is named for the same thing. */
  readonly store: string | null;
}

/** The setters one file has, given its address and its text. */
export function settersIn(module: string, text: string): LevelSetter[] {
  const stores = [...text.matchAll(/export const (\w+Store)\b/g)].map((match) => match[1]!);
  return [...text.matchAll(/export function (set([A-Z]\w*)Level)\(\s*\w+\s*:\s*ShaderLevel\s*\)/g)].map(
    (match) => {
      const stem = match[2]!.toLowerCase();
      return {
        module,
        setter: match[1]!,
        store: stores.find((store) => store.toLowerCase().startsWith(stem)) ?? null,
      };
    },
  );
}

/** Every shader level setter in a tree's web app, by walking its `src`. */
export function findSetters(tree: string): LevelSetter[] {
  const web = join(tree, 'frontend', 'apps', 'web');
  const found: LevelSetter[] = [];
  const walk = (folder: string): void => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'admin') walk(path);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        const text = readFileSync(path, 'utf8');
        if (text.includes('Level('))
          found.push(...settersIn(`/${relative(web, path).split(sep).join('/')}`, text));
      }
    }
  };
  walk(join(web, 'src'));
  return found.sort((a, b) => a.setter.localeCompare(b.setter));
}
