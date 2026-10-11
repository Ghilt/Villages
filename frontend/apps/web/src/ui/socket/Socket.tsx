import './socket.css';

import type { Showing } from '../button/Button';
import { fullnessSaid, socketSaid, socketsOf, SLOT_MOST } from './slots';
import type { SocketContent } from './slots';

/**
 * A socket: one place in a structure's slot, upright as a portrait is, three by four. Empty, it is a frame drawn
 * in fine dashes; filled with a person, their portrait covers it; with a thing, its picture, or the first letter
 * of its name until there is one, and how many of it on a velvet pip at its foot; not known to the viewer, a
 * question; and the last of a row too long for its room, how many more. Drawn, a velvet recess in a gilt line,
 * until one is painted. Given `onPress` it is a button, with the states every button has. See
 * docs/UI-COMPONENTS.md.
 */
export function Socket({
  content,
  size = 48,
  onPress,
  label,
  disabled = false,
  showing,
}: {
  content: SocketContent;
  /** How tall it is drawn, in pixels; it is three quarters as wide. */
  size?: number;
  onPress?: () => void;
  /** What a screen reader and the tooltip call it, when what it shows is not the whole of its name. */
  label?: string;
  disabled?: boolean;
  /** Draw it as if hovered, pressed or focused: for the page, never for the game. */
  showing?: Showing;
}) {
  const classes = [
    'ui-socket',
    `ui-socket--${content.kind}`,
    onPress === undefined ? '' : 'ui-socket--press',
    disabled ? 'ui-socket--disabled' : '',
    showing === undefined ? '' : `ui-socket--showing-${showing}`,
  ]
    .filter((one) => one !== '')
    .join(' ');
  const said = label ?? socketSaid(content);
  const style = { height: `${size}px`, width: `${Math.round(size * 0.75)}px`, fontSize: `${size / 48}rem` };
  const inside = <Inside content={content} />;
  return onPress === undefined ? (
    <span className={classes} style={style} role="img" aria-label={said} title={said}>
      {inside}
    </span>
  ) : (
    <button
      type="button"
      className={classes}
      style={style}
      onClick={onPress}
      disabled={disabled}
      aria-label={said}
      title={said}
    >
      {inside}
    </button>
  );
}

function Inside({ content }: { content: SocketContent }) {
  switch (content.kind) {
    case 'empty':
      return null;
    case 'portrait':
      return <img className="ui-socket__picture" src={content.picture} alt="" draggable={false} />;
    case 'item':
      return (
        <>
          {content.picture === undefined ? (
            <span className="ui-socket__initial" aria-hidden="true">
              {content.name
                .replace(/^(an?|the)\s+/i, '')
                .charAt(0)
                .toUpperCase()}
            </span>
          ) : (
            <img className="ui-socket__picture" src={content.picture} alt="" draggable={false} />
          )}
          {content.amount !== undefined && (
            <span className="ui-socket__amount ui-numeral" aria-hidden="true">
              {content.amount.toLocaleString()}
            </span>
          )}
        </>
      );
    case 'unknown':
      return (
        <span className="ui-socket__glyph" aria-hidden="true">
          ?
        </span>
      );
    case 'more':
      return (
        <span className="ui-socket__more ui-numeral" aria-hidden="true">
          +{content.count}
        </span>
      );
  }
}

/**
 * A slot's row: its name and how full it is on one line - *dungeon*, *2 of 3* - and under them a socket for each
 * place, what fills it first and an empty frame for each place left, wrapping when the room is narrow. A slot the
 * viewer is not told about is a question in every place and says only how many places it has. Past `most` the
 * last socket says how many more. `onPress` is called with what a filled socket holds, and its place in the row.
 */
export function SlotRow({
  name,
  places,
  contents,
  secret = false,
  most = SLOT_MOST,
  size = 48,
  onPress,
}: {
  name: string;
  /** How many places it has at the structure's level. */
  places: number;
  /** What is in it, in the order it was put there. */
  contents: readonly SocketContent[];
  secret?: boolean;
  most?: number;
  size?: number;
  onPress?: (content: SocketContent, at: number) => void;
}) {
  const sockets = socketsOf(contents, places, { secret, most });
  return (
    <div className="ui-slot">
      <div className="ui-slot__head">
        <span className="ui-caps ui-slot__name">{name}</span>
        <span className="ui-label ui-numeral ui-slot__count">
          {fullnessSaid(contents.length, places, secret)}
        </span>
      </div>
      <div className="ui-slot__sockets">
        {sockets.map((content, at) => {
          const pressable = onPress !== undefined && (content.kind === 'portrait' || content.kind === 'item');
          return (
            <Socket
              key={at}
              content={content}
              size={size}
              {...(pressable ? { onPress: () => onPress(content, at) } : {})}
            />
          );
        })}
      </div>
    </div>
  );
}
