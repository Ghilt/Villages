import '../ui/ui.css';
import './showcase/showcase.css';

import { useDensity } from './showcase/density';
import { SECTIONS } from './showcase/sections';
import type { Section } from './showcase/sections';
import { useSettings } from './showcase/settings';
import type { Ground, Layers, Width } from './showcase/settings';

/**
 * The component library, shown: every part the interface is built from, in every variant and state.
 *
 * Its own page, like the event log, and needing nothing else: no game server, no map, no house. A
 * component is looked at here before the game uses it, which makes this the instrument for the interface
 * that the debug panel is for the world. The sheet the components stand on can be narrowed to a phone's
 * width and put on night or on parchment, because a component has to read on both and at both. See
 * docs/UI-COMPONENTS.md and decision record 0068.
 */
export function UiComponents() {
  const [settings, change] = useSettings();
  const density = useDensity();

  return (
    <div
      className="showcase ui-root"
      data-width={settings.width}
      data-ground={settings.ground}
      data-ui-layers={settings.layers}
    >
      <header className="showcase__bar">
        <div className="showcase__heading">
          <h1 className="ui-title">Components</h1>
          <p className="ui-epigraph">The library, shown: every part the interface is built from</p>
        </div>
        <div className="showcase__switches">
          <Choice<Width>
            label="width"
            options={['desktop', 'phone']}
            chosen={settings.width}
            choose={(width) => change({ width })}
          />
          <Choice<Ground>
            label="ground"
            options={['night', 'parchment']}
            chosen={settings.ground}
            choose={(ground) => change({ ground })}
          />
          <Choice<Layers>
            label="layers"
            options={['hidden', 'shown']}
            chosen={settings.layers}
            choose={(layers) => change({ layers })}
          />
          <span className="showcase__density" title="screen pixels to a CSS pixel, which the seams depend on">
            screen {Number(density.toFixed(2))}x
          </span>
        </div>
      </header>

      <div className="showcase__body">
        <nav className="showcase__index" aria-label="Sections">
          <ol>
            {SECTIONS.map((section) => (
              <li key={section.id} className={section.Body === undefined ? 'showcase__index--to-come' : ''}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        <main className="showcase__sheet">
          {SECTIONS.map((section) => (
            <SectionOnShow key={section.id} section={section} />
          ))}
        </main>
      </div>
    </div>
  );
}

function SectionOnShow({ section }: { section: Section }) {
  const { Body } = section;
  return (
    <section id={section.id} className="showcase__section">
      <header className="showcase__section-bar">
        <h2 className="ui-caps">{section.title}</h2>
        <span className="showcase__rule" aria-hidden />
      </header>
      <p className="ui-label showcase__says">{section.says}</p>
      {Body !== undefined ? (
        <Body />
      ) : (
        <p className="showcase__to-come">Arrives with step {section.arrives} of the plan.</p>
      )}
    </section>
  );
}

/** One of a few, for the page's own switches. The library's own will replace it when it has one. */
function Choice<T extends string>({
  label,
  options,
  chosen,
  choose,
}: {
  label: string;
  options: readonly T[];
  chosen: T;
  choose: (option: T) => void;
}) {
  return (
    <span className="showcase__choice" role="group" aria-label={label}>
      <span className="showcase__choice-label">{label}</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="showcase__choice-option"
          aria-pressed={option === chosen}
          onClick={() => choose(option)}
        >
          {option}
        </button>
      ))}
    </span>
  );
}
