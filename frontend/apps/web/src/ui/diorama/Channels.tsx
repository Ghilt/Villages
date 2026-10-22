import './channels.css';

import type { Size } from './dioramaFit';

/** A place in a scene, in its units. */
interface Spot {
  readonly x: number;
  readonly y: number;
}

const pointsOf = (path: readonly Spot[]) => path.map((spot) => `${spot.x},${spot.y}`).join(' ');

/** A jolt along a diorama's channels: a key that changes with each, and the paths it runs along, each in a colour. */
export interface Jolt {
  readonly key: string | number;
  readonly lit: readonly { readonly path: number; readonly colour: string }[];
}

/**
 * Channels inlaid in a diorama's ground: a groove cut in it and a line of gilt laid in the groove, along each path given
 * in the scene's units - the path a venue's happenings travel, and the ways from its receptacle to each house's
 * platform. Given a `jolt`, a burst of light runs once along each path it lights, from its first spot to its last, in
 * that path's colour, and again whenever its key changes. Drawn as part of the ground, under everything that stands on
 * it. See docs/UI-COMPONENTS.md and decision record 0116.
 */
export function Channels({
  scene,
  paths,
  jolt,
}: {
  scene: Size;
  paths: readonly (readonly Spot[])[];
  jolt?: Jolt;
}) {
  return (
    <svg
      className="ui-channels"
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {paths.map((path, at) => (
        <g key={at}>
          <polyline points={pointsOf(path)} className="ui-channels__groove" />
          <polyline points={pointsOf(path)} className="ui-channels__gilt" />
        </g>
      ))}
      {jolt?.lit.map((one) => {
        const path = paths[one.path];
        return path === undefined ? null : (
          <polyline
            key={`${jolt.key}-${one.path}`}
            points={pointsOf(path)}
            pathLength={100}
            className="ui-channels__jolt"
            style={{ stroke: one.colour, color: one.colour }}
          />
        );
      })}
    </svg>
  );
}
