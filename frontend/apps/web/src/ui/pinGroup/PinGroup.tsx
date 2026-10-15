import './pinGroup.css';

import type { CSSProperties, MouseEvent, ReactNode } from 'react';

import { Container } from '../container/Container';
import { Grid } from '../grid/Grid';

/**
 * A crowd of marks opened: every mark the map drew as one, laid out in a grid on a card over the place, the most
 * significant first, each with its name under it. A press picks one; a press with Ctrl, or Cmd on a Mac, picks it to
 * be gone closer to. Five across at most, and a crowd of more scrolls inside the card. The card says nothing of where
 * it stands: the map puts it over the crowd. See docs/UI-COMPONENTS.md.
 */

/** One mark of the crowd: what it is called, and its picture, drawn by whoever knows how. */
export interface PinGroupMember {
  id: string;
  name: string;
  picture: ReactNode;
}

const MOST_ACROSS = 5;
/** How wide a cell is, in pixels: a pin and a short name under it. */
const CELL = 68;
const GAP = 6;

export function PinGroup({
  members,
  onPick,
  label = 'what stands here',
}: {
  members: readonly PinGroupMember[];
  /** A mark pressed, and whether it was pressed to be gone closer to. */
  onPick: (id: string, how: { closer: boolean }) => void;
  /** What a screen reader calls the card. */
  label?: string;
}) {
  const across = Math.max(1, Math.min(members.length, MOST_ACROSS));
  const style = { '--ui-pin-group-width': `${across * CELL + (across - 1) * GAP}px` } as CSSProperties;
  const pick = (id: string) => (event: MouseEvent) => onPick(id, { closer: event.ctrlKey || event.metaKey });
  return (
    <Container recipe="card.pins" className="ui-pin-group" style={style}>
      <div className="ui-pin-group__room" role="group" aria-label={label}>
        <Grid columns={across} gap={GAP} label={label}>
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              className="ui-pin-group__pin"
              title={`${member.name} - Ctrl to go there`}
              onClick={pick(member.id)}
            >
              <span className="ui-pin-group__picture" aria-hidden="true">
                {member.picture}
              </span>
              <span className="ui-pin-group__name">{member.name}</span>
            </button>
          ))}
        </Grid>
      </div>
    </Container>
  );
}

/**
 * One picture cut from a sheet of them, as the map's atlases are: `frame` is where on `sheet` it is, and it is drawn
 * `height` pixels tall at its own shape.
 */
export function SheetPicture({
  src,
  sheet,
  frame,
  height,
}: {
  src: string;
  sheet: { width: number; height: number };
  frame: { x: number; y: number; width: number; height: number };
  height: number;
}) {
  const scale = height / frame.height;
  return (
    <span
      className="ui-sheet-picture"
      style={{
        width: `${frame.width * scale}px`,
        height: `${height}px`,
        backgroundImage: `url(${src})`,
        backgroundSize: `${sheet.width * scale}px ${sheet.height * scale}px`,
        backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
      }}
    />
  );
}
