/** The words a tool was run with, after `node` and the tool's own path. */
export const args = process.argv.slice(2);

/** The value after `--name` on the command line, or undefined when it was not given. */
export const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at < 0 ? undefined : args[at + 1];
};

/** The words that are neither a flag nor a flag's value: a master's name, say. */
export const named = args.filter(
  (value, index) => !value.startsWith('--') && args[index - 1]?.startsWith('--') !== true,
);
