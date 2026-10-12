import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loaded before a world tool with `--import`, when `world:ready` makes a world cache entry: writes down every file
 * the tool opens to read, into the file `VILLAGES_READS` names, as it exits. `world:ready` refuses to file an entry
 * whose tool read a file its fingerprint does not count, because an entry filed under a fingerprint that misses
 * one of its inputs is a world every tree would borrow as current when it is not (decision record 0095).
 *
 * Every world tool reads through `readFile`, `readFileSync`, `open` or a read stream, which is what is watched;
 * `syncBuiltinESMExports` is what carries the watching into the names a tool imports from `node:fs`.
 */

const into = process.env.VILLAGES_READS;
if (into !== undefined) {
  const opened = new Set<string>();
  const note = (path: unknown) => {
    if (typeof path === 'string') opened.add(resolve(path));
    else if (path instanceof URL) opened.add(fileURLToPath(path));
    else if (Buffer.isBuffer(path)) opened.add(resolve(path.toString()));
  };
  const reading = (flags: unknown) =>
    flags === undefined || (typeof flags === 'string' && flags.startsWith('r'));

  const readFileSync = fs.readFileSync;
  fs.readFileSync = ((path: fs.PathOrFileDescriptor, ...rest: unknown[]) => {
    note(path);
    return (readFileSync as (...all: unknown[]) => unknown)(path, ...rest);
  }) as typeof fs.readFileSync;
  const openSync = fs.openSync;
  fs.openSync = ((path: fs.PathLike, ...rest: unknown[]) => {
    if (reading(rest[0])) note(path);
    return (openSync as (...all: unknown[]) => number)(path, ...rest);
  }) as typeof fs.openSync;
  const createReadStream = fs.createReadStream;
  fs.createReadStream = ((path: fs.PathLike, options?: unknown) => {
    note(path);
    return (createReadStream as (...all: unknown[]) => fs.ReadStream)(path, options);
  }) as typeof fs.createReadStream;
  const readFile = fs.promises.readFile;
  fs.promises.readFile = ((path: unknown, ...rest: unknown[]) => {
    note(path);
    return (readFile as (...all: unknown[]) => Promise<unknown>)(path, ...rest);
  }) as typeof fs.promises.readFile;
  const open = fs.promises.open;
  fs.promises.open = ((path: fs.PathLike, flags?: string | number, mode?: fs.Mode) => {
    if (reading(flags)) note(path);
    return open(path, flags, mode);
  }) as typeof fs.promises.open;
  syncBuiltinESMExports();

  process.on('exit', () => {
    fs.writeFileSync(into, [...opened].join('\n'));
  });
}
