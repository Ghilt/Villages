import type { ReactNode } from 'react';

/**
 * The marks a challenge is shown with, drawn as `Mark.tsx` draws every other, on a square of 24: the ten aspects it is
 * fought in, and the controls of its replay. Apart from the rest only so neither file grows long.
 */
export const CHALLENGE_MARKS = {
  // The ten aspects a challenge is fought in, one outline each before one picture each, because a slice's chip and a
  // happening show them at seventeen pixels. Not the stats' marks, which the same words name: an aspect is a way of
  // contending and a stat a person's. Drawn placeholders until a picture is painted for each; decision record 0116.
  /** Violence: two swords crossed, their guards low, so the cross is not a close. */
  'aspect-violence': (
    <>
      <path d="M6 18 L18.5 5.5 M18 18 L5.5 5.5" className="ui-mark__line" />
      <path d="M4.5 14.5 L9.5 19.5 M19.5 14.5 L14.5 19.5" className="ui-mark__line" />
    </>
  ),
  /** Diplomacy: an olive branch, its leaves on either side of the stem. */
  'aspect-diplomacy': (
    <>
      <path d="M5 19.5 C8.5 15 12.5 9.5 18.5 4.5" className="ui-mark__line" />
      <path d="M8.6 15.4 C6.2 15.2 4.8 13.6 5 11.6 C7.2 11.9 8.6 13.4 8.6 15.4 Z" className="ui-mark__line" />
      <path
        d="M9.8 13.6 C11.8 14.4 13.8 13.9 14.8 12.2 C13 11.2 10.9 11.8 9.8 13.6 Z"
        className="ui-mark__line"
      />
      <path
        d="M12.2 10.3 C10.6 8.6 10.8 6.4 12.4 5.2 C13.7 6.9 13.6 9 12.2 10.3 Z"
        className="ui-mark__line"
      />
      <path d="M14.6 7.8 C16.4 8.8 18.4 8.6 19.6 7.2 C18.1 5.9 16 6.2 14.6 7.8 Z" className="ui-mark__line" />
    </>
  ),
  /** Holy: a chalice. */
  'aspect-holy': (
    <>
      <path d="M7 4.5 H17 C17 9.6 15 12.4 12 12.4 C9 12.4 7 9.6 7 4.5 Z" className="ui-mark__line" />
      <path d="M12 12.4 V17" className="ui-mark__line" />
      <path d="M8 19.5 C8.6 17.8 10.2 17 12 17 C13.8 17 15.4 17.8 16 19.5 Z" className="ui-mark__line" />
    </>
  ),
  /** Reason: an open book, not the dividers a person's reason is. */
  'aspect-reason': (
    <>
      <path
        d="M3.5 6.5 C6.5 5.4 9.5 5.6 12 7.4 C14.5 5.6 17.5 5.4 20.5 6.5 V18.6 C17.5 17.6 14.5 17.8 12 19.6 C9.5 17.8 6.5 17.6 3.5 18.6 Z"
        className="ui-mark__line"
      />
      <path d="M12 7.4 V19.6" className="ui-mark__line" />
    </>
  ),
  /** Authority: a crown of three points on its band. */
  'aspect-authority': (
    <>
      <path d="M4.5 16.5 L4 8 L8.5 11.5 L12 5.5 L15.5 11.5 L20 8 L19.5 16.5 Z" className="ui-mark__line" />
      <path d="M4.5 19.5 H19.5" className="ui-mark__line" />
    </>
  ),
  /** Freedom: a swallow on the wing, its tail forked. */
  'aspect-freedom': (
    <>
      <path d="M2.5 8 C6.5 6.8 9.8 8.4 12 12.2 C14.2 8.4 17.5 6.8 21.5 8" className="ui-mark__line" />
      <path d="M12 12.2 L9.6 19.5 M12 12.2 L14.4 19.5 M10.6 16.4 H13.4" className="ui-mark__line" />
    </>
  ),
  /** Greed: a purse tied at the neck, fuller than the wealth's coin. */
  'aspect-greed': (
    <>
      <path
        d="M9.5 8.4 C6.2 10 4.5 12.8 4.5 15.6 C4.5 18.6 7.5 20.4 12 20.4 C16.5 20.4 19.5 18.6 19.5 15.6 C19.5 12.8 17.8 10 14.5 8.4"
        className="ui-mark__line"
      />
      <path d="M9.5 8.4 H14.5 M9 4.5 L10.5 8.4 M15 4.5 L13.5 8.4 M9 4.5 H15" className="ui-mark__line" />
    </>
  ),
  /** Generosity: a gift tied with a bow. */
  'aspect-generosity': (
    <>
      <path d="M5 11 H19 V20 H5 Z M3.8 7.8 H20.2 V11 H3.8 Z" className="ui-mark__line" />
      <path d="M12 7.8 V20" className="ui-mark__line" />
      <path
        d="M12 7.8 C9.8 3.8 6.4 5.2 8.2 7.8 M12 7.8 C14.2 3.8 17.6 5.2 15.8 7.8"
        className="ui-mark__line"
      />
    </>
  ),
  /** Nature: a leaf and its vein. */
  'aspect-nature': (
    <>
      <path d="M5 19.5 C4.6 10.8 10.4 4.9 19.6 4.4 C19.4 13.4 13.6 19.4 5 19.5 Z" className="ui-mark__line" />
      <path d="M5 19.5 L14.5 9.5" className="ui-mark__line" />
    </>
  ),
  /** Industry: a hammer over an anvil, not the settings' gear. */
  'aspect-industry': (
    <>
      <path
        d="M3.5 11.5 H16.5 C16.5 13.4 15.2 14.4 13.4 14.6 V16.6 H15.8 V19.5 H7.2 V16.6 H9.6 V14.6 C6.6 14.3 4.4 13.4 3.5 11.5 Z"
        className="ui-mark__line"
      />
      <path d="M14.6 3.2 L18.8 7.4 L17.2 9 L13 4.8 Z" className="ui-mark__line" />
      <path d="M15.9 6.1 L10.8 11.2" className="ui-mark__line" />
    </>
  ),
  // The replay of a challenge, every control a mark on Adam's word of 2026-10-21: play and pause, to the end, the pace
  // it is played at - one, two or three chevrons over a line, so the slowest is not the carousel's step - and the
  // history it opens. Drawn placeholders until a picture is painted for each; decision record 0116.
  play: <path d="M8 5.5 L18.5 12 L8 18.5 Z" className="ui-mark__fill" />,
  pause: <path d="M7 5.5 H10.5 V18.5 H7 Z M13.5 5.5 H17 V18.5 H13.5 Z" className="ui-mark__fill" />,
  'to-end': <path d="M5.5 5.5 L14.5 12 L5.5 18.5 Z M16 5.5 H18.5 V18.5 H16 Z" className="ui-mark__fill" />,
  'pace-1': <path d="M10 6 L14.5 11 L10 16 M5 20 H19" className="ui-mark__line" />,
  'pace-2': <path d="M7.5 6 L12 11 L7.5 16 M12.5 6 L17 11 L12.5 16 M5 20 H19" className="ui-mark__line" />,
  'pace-3': (
    <path
      d="M5 6 L9.5 11 L5 16 M10 6 L14.5 11 L10 16 M15 6 L19.5 11 L15 16 M5 20 H19.5"
      className="ui-mark__line"
    />
  ),
  /** The history: a scroll, rolled at its head, two lines written on it. */
  history: (
    <>
      <path
        d="M7.5 4.5 H17.5 C18.6 4.5 19.5 5.4 19.5 6.5 C19.5 7.6 18.6 8.5 17.5 8.5 H16.5 V17.5 C16.5 18.8 15.6 19.5 14.4 19.5 H6.5 C5.4 19.5 4.5 18.6 4.5 17.5 C4.5 16.4 5.4 15.5 6.5 15.5 H7.5 Z"
        className="ui-mark__line"
      />
      <path d="M7.5 15.5 V4.5 M10 9.5 H14 M10 12.5 H14" className="ui-mark__line" />
    </>
  ),
} satisfies Record<string, ReactNode>;
