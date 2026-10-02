/**
 * Where a scene is drawn from.
 *
 * The dev server serves `world/scenes/`, Adam's folder, without a cache, so a picture he saves over another is
 * the one drawn on the next reload. See `vite/scenesApi.ts`: development only, until there is a deployment to
 * publish the scenes with.
 */

/** The picture a scene's key names. */
export function sceneUrl(key: string): string {
  return `/scenes/${encodeURIComponent(key)}.png`;
}
