import { WORLD_CACHE } from './cache';
import { toolCard } from './graph';
import { TOOLS, secondsOfStep } from './world';
import type { Tool } from './world';

/** How long a tool takes, said shortly. */
export function took(tool: Tool): string {
  if (tool.time !== undefined) return tool.time;
  return inWords(tool.seconds);
}

/** A number of seconds, said shortly: seconds below a minute, minutes after. */
export function inWords(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = seconds / 60;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`;
}

/** What a world step is called on its bar: its tool's name, but for the painter, which writes only the styles here. */
const nameOf = (script: string) => (script === 'world:paint' ? 'styles' : script.replace('world:', ''));

/**
 * A master's world steps, one after the other, each a bar as long as its tool takes: the order `world:ready` makes
 * them in, for the quick start and the Debug map's buttons alike, when nobody has made them yet.
 */
export function Timeline(props: { stateOf: (card: string) => string; choose: (card: string) => void }) {
  const steps = WORLD_CACHE.tools.map((script) => TOOLS.find((t) => t.script === script)!);
  const total = steps.reduce((sum, t) => sum + secondsOfStep(t), 0);
  return (
    <section className="arch__timeline" aria-label="A master, step by step">
      <h2 className="arch__side-title">
        A master, step by step{' '}
        <span>the order world:ready makes them in when nobody has, as long as each takes</span>
      </h2>
      <div className="arch__steps">
        {steps.map((tool) => (
          <button
            key={tool.script}
            type="button"
            className={`arch__step ${props.stateOf(toolCard(tool.script))}`}
            style={{ flexGrow: secondsOfStep(tool) }}
            title={`${tool.script}: ${inWords(secondsOfStep(tool))}\n${tool.what}`}
            onClick={() => props.choose(toolCard(tool.script))}
          >
            <span>{nameOf(tool.script)}</span>
            <span>{inWords(secondsOfStep(tool))}</span>
          </button>
        ))}
      </div>
      <p className="arch__total">
        {Math.round(total / 60)} minutes in all, one after the other, once on the machine for a master and
        what it is made from; every tree after that borrows them from the world cache in seconds.
      </p>
    </section>
  );
}
