import { PROTOCOL_VERSION } from '@villages/protocol';

/**
 * What the corner of the window says about the thing you are looking at.
 *
 * Which branch, which commit, and which version of the wire it speaks. Small enough to ignore and
 * present enough to answer "is this main, and is it the latest" without leaving the page. The wire
 * version is here because it is the number a stale server disagrees about; see decision record 0037.
 */

export interface BuildHere {
  branch: string;
  commit: string;
  dirty: boolean;
}

/**
 * How much of a branch name the corner will carry.
 *
 * Long enough for `main` and for a human-named branch, short enough that a generated one does not run
 * across the bottom of the window. The end is what is cut, because the beginning is what tells you
 * whether you are looking at main.
 */
export const BRANCH_ROOM = 24;

function shortly(branch: string): string {
  return branch.length <= BRANCH_ROOM ? branch : `${branch.slice(0, BRANCH_ROOM - 1)}…`;
}

/** A page with no dev server to ask still knows what it speaks, so the label is never empty. */
export function badgeText(build: BuildHere | null): string {
  const parts: string[] = [];
  if (build !== null && build.branch !== '') {
    parts.push(shortly(build.branch));
  }
  if (build !== null && build.commit !== '') {
    // A plus, not the word: the corner is four millimetres tall and the mark is for the person who
    // already knows there are uncommitted changes and wants reminding which window has them.
    parts.push(build.dirty ? `${build.commit}+` : build.commit);
  }
  parts.push(`wire v${PROTOCOL_VERSION}`);
  return parts.join(' · ');
}

/** Whether what came back over the wire from the dev server is a build description at all. */
export function readBuild(said: unknown): BuildHere | null {
  if (typeof said !== 'object' || said === null) {
    return null;
  }
  const { branch, commit, dirty } = said as Record<string, unknown>;
  if (typeof branch !== 'string' || typeof commit !== 'string' || typeof dirty !== 'boolean') {
    return null;
  }
  return { branch, commit, dirty };
}
