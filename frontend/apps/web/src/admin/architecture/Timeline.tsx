import { toolCard } from './graph';
import { TOOLS } from './world';
import type { Tool } from './world';

/** How long a tool takes, said shortly. */
export function took(tool: Tool): string {
  if (tool.time !== undefined) return tool.time;
  if (tool.seconds < 60) return `${tool.seconds} s`;
  const minutes = tool.seconds / 60;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`;
}

/** The order the quick-start and the panel's `cut it` run a master's tools in. */
const ORDER = [
  'world:import',
  'world:tile',
  'world:flow',
  'world:sprites',
  'world:ground',
  'world:origin',
  'world:culture',
  'world:height',
];

/** A master's tools, one after the other, each a bar as long as it takes. */
export function Timeline(props: { stateOf: (card: string) => string; choose: (card: string) => void }) {
  const steps = ORDER.map((script) => TOOLS.find((t) => t.script === script)!);
  const total = steps.reduce((sum, t) => sum + t.seconds, 0);
  return (
    <section className="arch__timeline" aria-label="A master, step by step">
      <h2 className="arch__side-title">
        A master, step by step{' '}
        <span>the order the quick-start and the panel's cut it run them, as long as each takes</span>
      </h2>
      <div className="arch__steps">
        {steps.map((tool) => (
          <button
            key={tool.script}
            type="button"
            className={`arch__step ${props.stateOf(toolCard(tool.script))}`}
            style={{ flexGrow: tool.seconds }}
            title={`${tool.script}: ${took(tool)}\n${tool.what}`}
            onClick={() => props.choose(toolCard(tool.script))}
          >
            <span>{tool.script.replace('world:', '')}</span>
            <span>{took(tool)}</span>
          </button>
        ))}
      </div>
      <p className="arch__total">
        {Math.round(total / 60)} minutes in all, one after the other; then the styles (a second) and the
        pictures (seconds) on every start.
      </p>
    </section>
  );
}
