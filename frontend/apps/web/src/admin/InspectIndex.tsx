import './inspect-index.css';

import { Mark } from '../ui/mark/Mark';
import type { MarkName } from '../ui/mark/Mark';

import { InspectPage } from './frame/InspectPage';
import { INSPECT_SECTIONS, INSPECT_VIEWS } from './inspectViews';

/**
 * The pages beside the game, listed: what each is for and what it needs running. Its own page at
 * `/admin`, so there is one address to remember rather than one a page. The pages stand in sections by what they
 * are for, each card with its mark, and a row of the sections' names at the top goes straight to one, because a
 * page was getting hard to find among the rest.
 */

function Card({
  href,
  title,
  what,
  meta,
  mark,
  game = false,
}: {
  href: string;
  title: string;
  what: string;
  meta: string;
  mark: MarkName;
  game?: boolean;
}) {
  return (
    <li>
      <a className={`inspect-index__card${game ? ' inspect-index__card--game' : ''}`} href={href}>
        <span className="inspect-index__head">
          <Mark name={mark} size={24} />
          <span className="inspect-index__name">{title}</span>
        </span>
        <span className="inspect-index__what">{what}</span>
        <span className="inspect-index__meta">{meta}</span>
      </a>
    </li>
  );
}

export function InspectIndex() {
  return (
    <InspectPage title="Inspect" epigraph="The pages beside the game, for looking into it" back={false}>
      <nav className="inspect-index__sections" aria-label="Sections">
        {INSPECT_SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`}>
            {section.title}
          </a>
        ))}
      </nav>
      {INSPECT_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="inspect-index__section">
          <h2 className="inspect-index__title">{section.title}</h2>
          <p className="inspect-index__about">{section.what}</p>
          <ul className="inspect-index__list">
            {INSPECT_VIEWS.filter((view) => view.section === section.id).map((view) => (
              <Card
                key={view.path}
                href={view.path}
                title={view.title}
                what={view.what}
                meta={`${view.path} · needs ${view.needs}`}
                mark={view.mark}
              />
            ))}
            {section.id === 'running' && (
              <Card
                href="/"
                title="The game"
                what="The map, the panes, and the debug panel beside them."
                meta="/ · needs the game server"
                mark="map"
                game
              />
            )}
          </ul>
        </section>
      ))}
    </InspectPage>
  );
}
