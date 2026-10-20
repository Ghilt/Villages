import './performance.css';

import { InspectPage } from '../frame/InspectPage';
import { ServerRuns } from './ServerRuns';
import { Shaders } from './Shaders';
import { Startup } from './Startup';

/**
 * What the game costs to run, and how that moves as it is built: a chapter for each history the performance tools
 * keep in `docs/experiments/performance/`, each folded under its title - what the shaders cost the graphics card, and
 * how many players one game server carries. Nothing on it is measured by the page; each chapter says what measures
 * it. See decision record 0106 and `docs/plans/performance-history.md`.
 */
export function Performance() {
  return (
    <InspectPage title="Performance" epigraph="What the game costs to run, and how that moves as it is built">
      <Shaders />
      <Startup />
      <ServerRuns />
    </InspectPage>
  );
}
