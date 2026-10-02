import './dialog.css';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

import { MarkButton } from '../button/Button';
import { Container } from '../container/Container';
import type { Recipe } from '../container/layout';
import type { RecipeName } from '../container/recipes';
import { ScrollArea } from '../scroll/ScrollArea';

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
 * for a page to show standing still. See docs/UI-COMPONENTS.md.
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
