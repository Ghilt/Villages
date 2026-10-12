import { FRESH_TREE, STAGES } from './starting';
import { inWords } from './Timeline';

/**
 * Starting a tree: each part of the quick start a bar on one clock, where it began and how long it took in a
 * brand-new worktree, the game server's beside the rest; and what each took before the world cache.
 */
export function Startup() {
  const end = FRESH_TREE.seconds;
  return (
    <section className="arch__start" aria-label="Starting a tree">
      <h2 className="arch__side-title">
        Starting a tree{' '}
        <span>
          a brand-new worktree, its world on the world cache&apos;s shelf, measured {FRESH_TREE.measured}
        </span>
      </h2>
      <ol className="arch__lanes">
        {STAGES.map((stage) => (
          <li key={stage.name} className="arch__lane" title={stage.what}>
            <span className="arch__lane-name">{stage.name}</span>
            <span className="arch__track">
              <span
                className={`arch__span ${stage.beside === true ? 'arch__span--beside' : ''}`}
                style={{ left: `${(100 * stage.from) / end}%`, width: `${(100 * stage.seconds) / end}%` }}
              />
            </span>
            <span className="arch__lane-time">
              {inWords(stage.seconds)}
              {stage.made === undefined ? '' : ` borrowed; ${inWords(stage.made)} made, once for every tree`}
              <span className="arch__was"> was {inWords(stage.was)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="arch__total">
        Ready in {FRESH_TREE.seconds} seconds, where a fresh tree took about {Math.round(FRESH_TREE.was / 60)}{' '}
        minutes, fifteen of them making a world another tree had already made. The first tree after a change
        to the master or a world tool makes what changed, and only that, for every tree.
      </p>
    </section>
  );
}
