import './mist.css';

/**
 * A patch of mist in a diorama: soft cream puffs drifting and breathing over the spot a venue's happenings come out
 * of. Its box's bottom middle stands on that spot. Drawn rather than painted. See docs/UI-COMPONENTS.md.
 */
export function Mist({ width = 140 }: { width?: number }) {
  return (
    <span className="ui-mist" style={{ width, height: width * 0.62 }} aria-hidden="true">
      <span className="ui-mist__puff ui-mist__puff--one" />
      <span className="ui-mist__puff ui-mist__puff--two" />
      <span className="ui-mist__puff ui-mist__puff--three" />
      <span className="ui-mist__puff ui-mist__puff--four" />
    </span>
  );
}
