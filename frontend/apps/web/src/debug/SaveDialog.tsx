import { useEffect, useRef, useState } from 'react';

/** The name a save may have, as the server holds it: lower-case letters, digits and single hyphens, at most 60. */
const A_NAME = /^(?=.{1,60}$)[a-z0-9]+(-[a-z0-9]+)*$/;

interface SaveDialogProps {
  open: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}

/**
 * Asks what to call a save of the world, over the page: the browser's own modal dialog, drawn as the panel's
 * controls are, because the panel is Adam's and the component library is the player's. Enter saves, Escape puts it
 * away. A name the server would refuse is said here before it is sent; one taken is said by the server. See 0101.
 */
export function SaveDialog({ open, onSave, onClose }: SaveDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    const box = dialog.current;
    if (box === null) return;
    if (open && !box.open) {
      setName('');
      box.showModal();
    } else if (!open && box.open) {
      box.close();
    }
  }, [open]);

  const fits = A_NAME.test(name);
  return (
    <dialog ref={dialog} className="debug-save" onClose={onClose}>
      <form
        method="dialog"
        onSubmit={(event) => {
          if (!fits) {
            event.preventDefault();
            return;
          }
          onSave(name);
        }}
      >
        <label className="debug-map__label" htmlFor="save-name">
          Save the world as
        </label>
        <input
          id="save-name"
          className="debug-map__select debug-save__name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="completed-many-quests"
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
        <p className="debug-map__note">
          {name === '' || fits
            ? 'Lower-case letters, digits and hyphens. Every tree can load it.'
            : 'Only lower-case letters, digits and single hyphens, at most 60.'}
        </p>
        <div className="debug__levers">
          <button type="submit" className="debug__button" disabled={!fits}>
            save
          </button>
          <button type="button" className="debug__button" onClick={onClose}>
            cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
