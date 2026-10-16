import './inspect-index.css';

import { InspectPage } from './frame/InspectPage';
import { INSPECT_VIEWS } from './inspectViews';

/**
 * The pages beside the game, listed: what each is for and what it needs running. Its own page at
 * `/admin`, so there is one address to remember rather than one a page.
 */
export function InspectIndex() {
  return (
    <InspectPage title="Inspect" epigraph="The pages beside the game, for looking into it" back={false}>
      <ul className="inspect-index__list">
        {INSPECT_VIEWS.map((view) => (
          <li key={view.path}>
            <a className="inspect-index__card" href={view.path}>
              <span className="inspect-index__name">{view.title}</span>
              <span className="inspect-index__what">{view.what}</span>
              <span className="inspect-index__meta">
                {view.path} · needs {view.needs}
              </span>
            </a>
          </li>
        ))}
        <li>
          <a className="inspect-index__card inspect-index__card--game" href="/">
            <span className="inspect-index__name">The game</span>
            <span className="inspect-index__what">The map, the panes, and the debug panel beside them.</span>
            <span className="inspect-index__meta">/ · needs the game server</span>
          </a>
        </li>
      </ul>
    </InspectPage>
  );
}
