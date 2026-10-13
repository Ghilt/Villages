import '../inspect-index.css';
import './architecture.css';
import './overview.css';

import { useCallback, useMemo, useState } from 'react';

import { BackToIndex } from '../InspectIndex';
import { Robot } from './Cards';
import { Diagram } from './Diagram';
import { Focus } from './Focus';
import { related } from './graph';
import { layOut } from './layout';
import { Startup } from './Startup';
import { FRESH_TREE } from './starting';
import { Timeline } from './Timeline';
import { ARTIFACTS, LEGACY, TOOLS, readAtRuntime, secondsForAMaster } from './world';

/**
 * How the world is set up, drawn as a diagram that flows down the page: what Adam authors and what is
 * downloaded, the tools that bake the world from it and how long each takes, the files they write, and,
 * beneath a dotted line, the running game and what it reads and keeps. Choosing a card lights everything it
 * depends on and everything that depends on it. Drawn from `world.ts`, which `world.test.ts` holds true.
 */
export function InspectArchitecture() {
  const [chosen, choose] = useState<string | null>(null);
  const { placed, arrows, line, sources } = useMemo(layOut, []);
  const cards = useMemo(() => placed.map((p) => p.card), [placed]);
  const lit = useMemo(
    () => (chosen === null ? null : related(chosen, arrows, cards)),
    [chosen, arrows, cards],
  );
  // A piece inside a group that is lit is lit with it: the group is the whole process the files are read by.
  const groupOf = useMemo(() => new Map(placed.map((p) => [p.card.id, p.parent])), [placed]);
  const stateOf = useCallback(
    (card: string) => {
      if (lit === null) return '';
      if (card === chosen) return 'is-chosen';
      const inside = groupOf.get(card);
      return lit.has(card) || (inside !== undefined && lit.has(inside)) ? 'is-lit' : 'is-dim';
    },
    [lit, chosen, groupOf],
  );
  const minutes = Math.round(secondsForAMaster() / 60);

  return (
    <main className="arch inspect-index">
      <header className="inspect-index__bar arch__bar">
        <div>
          <h1 className="inspect-index__title">Architecture</h1>
          <p className="inspect-index__epigraph">
            How the world is set up: what is baked beforehand, and what the running game reads
          </p>
        </div>
        <BackToIndex />
      </header>

      <section className="arch__tiles" aria-label="In numbers">
        <Tile
          figure={`${FRESH_TREE.seconds} s`}
          label="a brand-new worktree to the game, its world borrowed"
        />
        <Tile
          figure={`${minutes} min`}
          label="a master's world from its painting, made once for every tree"
        />
        <Tile figure={`${TOOLS.length}`} label="tools that bake the world beforehand" />
        <Tile
          figure={`${ARTIFACTS.filter((a) => a.origin !== 'baked').length}`}
          label="files and folders authored or downloaded"
        />
        <Tile figure={`${readAtRuntime().length}`} label="baked files the running game depends on" />
      </section>

      <Startup />

      <Timeline stateOf={stateOf} choose={choose} />

      <Focus chosen={chosen} clear={() => choose(null)} />

      <Diagram
        placed={placed}
        arrows={arrows}
        line={line}
        sources={sources}
        stateOf={stateOf}
        choose={choose}
      />

      <footer className="arch__legend" aria-label="Legend">
        <span className="arch__key arch__key--authored">by Adam</span>
        <span className="arch__key arch__key--fetched">downloaded</span>
        <span className="arch__key arch__key--baked">made by a tool</span>
        <span className="arch__key arch__key--tool">a tool</span>
        <span className="arch__key arch__key--run">running</span>
        <span className="arch__key arch__key--yet">running, not used yet</span>
        <span className="arch__key arch__key--agent">
          <Robot /> for development: only an agent at work reads it or runs it, never the game
        </span>
        <p className="arch__legacy">
          Not drawn: Adam&apos;s own tools in <code>scripts/</code>, <code>mend-rivers</code> (it writes the
          master it reads), <code>nine-slice</code> (it writes a border into world/ui), <code>check</code> (it
          runs every check in the repository) and <code>drop-gone-worlds</code> (it drops the worlds of
          worktrees that are gone); and {LEGACY.map((l) => `${l.script} (${l.why})`).join('; ')}.
        </p>
      </footer>
    </main>
  );
}

function Tile({ figure, label }: { figure: string; label: string }) {
  return (
    <div className="arch__tile">
      <span className="arch__figure">{figure}</span>
      <span className="arch__tile-label">{label}</span>
    </div>
  );
}
