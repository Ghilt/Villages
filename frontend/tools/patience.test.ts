import { describe, expect, it } from 'vitest';

import config from '../vitest.config.ts';

/**
 * Every project of the tests is as patient as the others: twenty seconds a test and sixty a hook, so a test fails for
 * what it found and never for a machine every other tree is testing on too. A project added without it would be on
 * Vitest's five seconds again, and fail only on a busy afternoon. See vitest.config.ts and docs/TESTING.md.
 */
describe('the time a test is given', () => {
  it('is the same in every project, and long enough that only a hung test runs out of it', () => {
    const projects = (config.test?.projects ?? []) as readonly {
      test?: { name?: string; testTimeout?: number; hookTimeout?: number };
    }[];
    expect(projects.length).toBeGreaterThan(0);
    expect(
      projects.map((project) => [project.test?.name, project.test?.testTimeout, project.test?.hookTimeout]),
    ).toEqual(projects.map((project) => [project.test?.name, 20_000, 60_000]));
  });
});
