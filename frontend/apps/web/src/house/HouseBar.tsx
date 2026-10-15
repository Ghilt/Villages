/** How many places the bar has. They stand empty until there is something to put in them. */
const SLOTS = 6;

/**
 * The bar along the bottom of the house: what the player does, as opposed to what the house is.
 *
 * Part of the house rather than furniture floating over the map, because these are the house's own
 * levers and they should read as belonging to it. The empty places are drawn rather than left out, so
 * the bar is the shape it will be when it is full and nothing moves as it fills.
 */
export function HouseBar() {
  const empties = Array.from({ length: SLOTS }, (_, index) => index);

  return (
    <div className="housebar" role="toolbar" aria-label="What the house does">
      {empties.map((slot) => (
        <div className="housebar__slot housebar__slot--empty" key={slot} aria-hidden="true" />
      ))}
    </div>
  );
}
