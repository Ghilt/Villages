import './performance.css';

import { InspectPage } from '../frame/InspectPage';
import { ServerRuns } from './ServerRuns';
import { Shaders } from './Shaders';
import { Startup } from './Startup';
import { Tests } from './Tests';
import { Zoom } from './Zoom';

/**
 * What the game costs to run, and how that moves as it is built: a chapter for each history the performance tools
 * keep in `docs/experiments/performance/`, each folded under its title - what the shaders cost the graphics card, how
 * long the game takes to start, how smoothly the camera comes in, how long the tests take, and how many players one
 * game server carries. Nothing on it is measured by the page; each chapter says what measures it. See decision record
 * 0106 and `docs/plans/performance-history.md`.
 */
export function Performance() {
  return (
    <InspectPage title="Performance" epigraph="What the game costs to run, and how that moves as it is built">
      <Shaders />
      <Startup />
      <Zoom />
      <Tests />
      <ServerRuns />
    </InspectPage>
  );
}
