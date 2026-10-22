import './channels.css';

import type { Size } from './dioramaFit';

/** A place in a scene, in its units. */
interface Spot {
  readonly x: number;
  readonly y: number;
}

const pointsOf = (path: readonly Spot[]) => path.map((spot) => `${spot.x},${spot.y}`).join(' ');

/**
 * Channels inlaid in a diorama's ground: a groove cut in it and a line of gilt laid in the groove, along each path given
 * in the scene's units - the path a venue's happenings travel, and the ways from its receptacle to each house's
 * platform. Drawn as part of the ground, under everything that stands on it. See docs/UI-COMPONENTS.md and decision
 * record 0116.
 */
export function Channels({ scene, paths }: { scene: Size; paths: readonly (readonly Spot[])[] }) {
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
    </svg>
  );
}
