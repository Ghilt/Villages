import { eyeStore, toggleEye } from './eye';
import { useStore } from '../store/useStore';

/**
 * The eye, open and shut. Two states of one mark rather than two marks: the almond is the same curve in
 * both, so pressing it changes what the eye is doing rather than which icon is there.
 */
const EYE = {
  almond: 'M2.2 12 C6 6.2 18 6.2 21.8 12 C18 17.8 6 17.8 2.2 12 Z',
  lid: 'M2.8 10.4 C6.5 15.8 17.5 15.8 21.2 10.4',
  lashes: ['M5.2 13.9 L3.5 16.6', 'M9.2 15.6 L8.4 18.6', 'M14.8 15.6 L15.6 18.6', 'M18.8 13.9 L20.5 16.6'],
} as const;

/** How many places the bar has. The rest stand empty until there is something to put in them. */
const SLOTS = 6;

interface HouseBarProps {
  /** Whether there is a house to act for. Before there is one every place is inert, the eye included. */
  borne: boolean;
}

/**
 * The bar along the bottom of the house: what the player does, as opposed to what the house is.
 *
 * Part of the house rather than furniture floating over the map, because these are the house's own
 * levers and they should read as belonging to it. The empty places are drawn rather than left out, so
 * the bar is the shape it will be when it is full and nothing moves as it fills.
 */
export function HouseBar({ borne }: HouseBarProps) {
  const open = useStore(eyeStore, (state) => state.open);
  const empties = Array.from({ length: SLOTS - 1 }, (_, index) => index);

  return (
    <div className="housebar" role="toolbar" aria-label="What the house does">
      <button
        type="button"
        className={
          open ? 'housebar__slot housebar__button housebar__button--on' : 'housebar__slot housebar__button'
        }
        aria-pressed={open}
        disabled={!borne}
        aria-label={open ? 'Stop keeping your holdings in sight' : 'Keep your holdings in sight'}
        title={
          borne
            ? open
              ? 'Your holdings stay drawn at any zoom. Press to let them thin out with the rest.'
              : 'Keep your own holdings drawn at any zoom, however far back the camera goes.'
            : 'Nothing to keep in sight until the house is founded.'
        }
        onClick={toggleEye}
      >
        <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
          {open ? (
            <>
              <path d={EYE.almond} className="housebar__glyph" />
              <circle cx="12" cy="12" r="3.2" className="housebar__pupil" />
            </>
          ) : (
            <>
              <path d={EYE.lid} className="housebar__glyph" />
              {EYE.lashes.map((lash) => (
                <path d={lash} key={lash} className="housebar__glyph" />
              ))}
            </>
          )}
        </svg>
      </button>

      {empties.map((slot) => (
        <div className="housebar__slot housebar__slot--empty" key={slot} aria-hidden="true" />
      ))}
    </div>
  );
}
