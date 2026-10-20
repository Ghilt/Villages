/**
 * Every TypeScript project the frontend's typecheck checks, by its tsconfig: a folder's own `tsconfig.json`, or a named
 * one beside it. `typecheck.ts` runs them; `typecheck.test.ts` fails for a tsconfig in the frontend that is not here, so
 * a new one cannot go unchecked.
 */
export const PROJECTS = [
  'packages/protocol',
  'packages/protocol/tsconfig.test.json',
  'packages/client-core',
  'packages/world',
  'packages/world/tsconfig.test.json',
  'packages/world/tsconfig.bin.json',
  'apps/web',
  'apps/web/tsconfig.node.json',
  'tools',
  'e2e',
  'perf',
] as const;

/** The tsconfig a project names: its folder's `tsconfig.json`, or the file itself. */
export function tsconfigOf(project: string): string {
  return project.endsWith('.json') ? project : `${project}/tsconfig.json`;
}
