import './dialog.css';

import { createContext, useContext, useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { MarkButton } from '../button/Button';
import { Container } from '../container/Container';
import type { Recipe } from '../container/layout';
import type { RecipeName } from '../container/recipes';
import { ScrollArea } from '../scroll/ScrollArea';

/** The room the dialogs opened inside a `DialogRoom` stand in, or none, and they stand over the whole window. */
const Room = createContext<HTMLElement | null>(null);

/**
 * Where the dialogs opened inside it stand: over [room] alone rather than over the whole window. The game's stage is
 * one, so a dialog keeps to a phone's size when the stage is confined to one, and what stands beside the stage, the
 * debug panel, stays in reach. [room] is positioned, and its children are a dialog's to put out of reach while it
 * stands there; null until it is drawn, and until then a dialog stands over the window.
 */
export function DialogRoom({ room, children }: { room: HTMLElement | null; children: ReactNode }) {
  return <Room.Provider value={room}>{children}</Room.Provider>;
}

interface DialogParts {
  /** What is being asked, in words: Kill Count Henri de Montreuil? */
  title: ReactNode;
  /** What there is to know before answering. */
  children?: ReactNode;
  /** The answers, last the one the question is about: Spare him, then Kill. */
  actions?: ReactNode;
  recipe?: RecipeName | Recipe;
}

/**
 * A dialog: a question that has to be answered before anything else - kill this key figure? - in a
 * container over the whole page, the page behind it dimmed and out of reach until it is answered.
 *
 * The browser's own modal dialog is under it, so it is drawn over everything, the keyboard stays inside it,
 * and when it goes the keyboard goes back to whatever opened it. Escape, its close mark and a press on the
 * dimmed page all put it away, which is `onClose`, unless it is not `dismissable`. Whoever uses it holds
 * whether it is `open`; the page behind it does not scroll while it is. `DialogBox` is its frame alone,
 * for a page to show standing still.
 *
 * **Inside a `DialogRoom` it stands over the room alone**: drawn into it, dimming it, the rest of the room out of
 * reach and what is outside the room not. See docs/UI-COMPONENTS.md.
 */
export function Dialog({
  open,
  onClose,
  dismissable = true,
  ...parts
}: DialogParts & {
  open: boolean;
  /** It is put away without being answered. */
  onClose: () => void;
  /** Whether Escape, the close mark and the dimmed page put it away: true unless it says otherwise. */
  dismissable?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const stillOpen = useRef(open);
  stillOpen.current = open;
  const pressedOutside = useRef(false);
  const room = useContext(Room);

  useEffect(() => {
    const box = dialog.current;
    if (box === null) {
      return;
    }
    if (open && !box.open) {
      box.showModal();
    } else if (!open && box.open) {
      box.close();
    }
  }, [open]);

  if (room !== null) {
    return <InTheRoom room={room} open={open} onClose={onClose} dismissable={dismissable} {...parts} />;
  }
  return (
    <dialog
      ref={dialog}
      className="ui-dialog"
      aria-labelledby={title}
      // Escape: put away by whoever holds it, not by the browser behind their back.
      onCancel={(event) => {
        event.preventDefault();
        if (dismissable) {
          onClose();
        }
      }}
      // Shut by the browser itself - Escape pressed twice running - while it was still held open. The
      // browser says so a moment after, so a dialog opened again in that moment is not shut by the news.
      onClose={(event) => {
        if (stillOpen.current && !event.currentTarget.open) {
          onClose();
        }
      }}
      onPointerDown={(event) => {
        pressedOutside.current = event.target === event.currentTarget;
      }}
      // A press on the dimmed page, begun there too, so a drag out of the dialog does not put it away.
      onClick={(event) => {
        if (dismissable && pressedOutside.current && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {open && <DialogBox {...parts} titleId={title} {...(dismissable ? { onClose } : {})} />}
    </dialog>
  );
}

/** What the keyboard is given to as a dialog opens, as the browser's modal dialog gives it: the first that takes it. */
const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A dialog in a room, over the room alone: everything else in the room made inert while it stands, so neither a
 * press nor the keyboard reaches what is behind it, and given back when it goes, with the keyboard to whatever had
 * it. The browser's modal dialog cannot be kept to a part of the page, so this does by hand what it does: the
 * keyboard to the first thing in it, and Escape and a press on the dimmed room to put it away.
 */
function InTheRoom({
  room,
  open,
  onClose,
  dismissable,
  ...parts
}: DialogParts & { room: HTMLElement; open: boolean; onClose: () => void; dismissable: boolean }) {
  const title = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const inside = box.current;
    if (!open || inside === null) {
      return;
    }
    const standing = inside.parentElement;
    const behind = [...room.children].filter((child) => child !== standing && !child.hasAttribute('inert'));
    for (const child of behind) {
      child.setAttribute('inert', '');
    }
    const had = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (inside.querySelector<HTMLElement>(FOCUSABLE) ?? inside).focus();
    return () => {
      for (const child of behind) {
        child.removeAttribute('inert');
      }
      had?.focus();
    };
  }, [open, room]);

  if (!open) {
    return null;
  }
  return createPortal(
    <div
      className="ui-dialog-room"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          if (dismissable) {
            onClose();
          }
        }
      }}
    >
      {/* Only a press begun and ended on it lands on it: one begun in the dialog lands on what holds them both. */}
      <div className="ui-dialog-room__veil" onClick={dismissable ? onClose : undefined} />
      <div
        ref={box}
        className="ui-dialog ui-dialog--in-room"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title}
        tabIndex={-1}
      >
        <DialogBox {...parts} titleId={title} {...(dismissable ? { onClose } : {})} />
      </div>
    </div>,
    room,
  );
}

/**
 * A dialog's frame: its question and its close mark, what there is to know - in a scroll area, when there
 * is more of it than the window has room for - and its answers.
 */
export function DialogBox({
  title,
  children,
  actions,
  recipe = 'dialog.plain',
  titleId,
  onClose,
}: DialogParts & {
  /** The id its question is said by, so the dialog round it is named by it. */
  titleId?: string;
  /** Putting it away, by its close mark; no mark without it. */
  onClose?: () => void;
}) {
  return (
    <Container recipe={recipe} className="ui-dialog__box">
      <header className="ui-dialog__head">
        <h2 id={titleId} className="ui-heading ui-dialog__title">
          {title}
        </h2>
        {onClose !== undefined && <MarkButton label="Close" face="close" size="small" onClick={onClose} />}
      </header>
      {children !== undefined && (
        <ScrollArea className="ui-dialog__body" label="What it says">
          {children}
        </ScrollArea>
      )}
      {actions !== undefined && <div className="ui-dialog__actions">{actions}</div>}
    </Container>
  );
}
