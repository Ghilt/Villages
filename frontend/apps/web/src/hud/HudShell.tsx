const EMPTY_SHIELD = 'M3 3 H37 V21 C37 31 20 39 20 39 C20 39 3 31 3 21 Z';

/**
 * The interface a player sees before there is anything to see: the frame their house will occupy. It stays
 * deliberately quiet, and the slots are filled as the walking skeleton lands.
 */
export function HudShell() {
  return (
    <div className="hud" aria-live="polite">
      <header className="hud__title">Villages</header>

      <section className="hud__panel">
        <div className="hud__banner" aria-hidden="true">
          <svg viewBox="0 0 40 42" role="presentation">
            <path d={EMPTY_SHIELD} className="hud__shield" />
          </svg>
        </div>
        <div className="hud__house">
          <p className="hud__name">No house yet</p>
          <p className="hud__hint">The map is the world. Your seat is somewhere on it.</p>
          <dl className="hud__resources">
            <dt>Treasury</dt>
            <dd>&mdash;</dd>
          </dl>
        </div>
      </section>
    </div>
  );
}
