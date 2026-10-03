import type sharpModule from 'sharp';

/**
 * sharp, the one package these tools install, for the ones that read or write WebP: Node cannot. Loaded when
 * a tool asks rather than imported, so that a tool that does not need it runs before `npm install` has, and
 * one that does says what to do instead of failing on a missing module. See decision record 0082.
 */
export async function loadSharp(): Promise<typeof sharpModule> {
  try {
    return (await import('sharp')).default;
  } catch {
    console.error(
      'this tool writes WebP with sharp, which is not installed here yet. Run this once, in this',
    );
    console.error('folder, and then the tool again:\n\n  npm install\n');
    process.exit(1);
  }
}
