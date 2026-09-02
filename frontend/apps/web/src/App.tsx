import { HudShell } from './hud/HudShell';
import { MapView } from './map/MapView';

export function App() {
  return (
    <main className="app">
      <MapView />
      <HudShell />
    </main>
  );
}
