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
 * Everything the label says after the branch. The branch is shown whole and apart from it, so it can be
 * copied on its own: a worktree is found by its name, and a name cut short finds nothing.
 */
export function badgeText(build: BuildHere | null): string {
  const parts: string[] = [];
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
