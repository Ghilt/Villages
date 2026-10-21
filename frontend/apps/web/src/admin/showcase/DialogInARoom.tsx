import './dialogRoom.css';

import { useState } from 'react';

import { TextButton } from '../../ui/button/Button';
import { Dialog, DialogRoom } from '../../ui/dialog/Dialog';

/**
 * A room the size of a phone, as the game's stage is when it is confined to one, with a dialog to open in it: over
 * the room alone and sized to it, while the page round it stays in reach. One that puts itself away, as the settings
 * do on the desktop, or one that nothing puts away but an answer, as the signed-out screen.
 */
export function DialogInARoom({ dismissable }: { dismissable: boolean }) {
  const [room, setRoom] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [said, say] = useState('nothing asked yet');
  const answer = (what: string) => {
    setOpen(false);
    say(what);
  };
  return (
    <div className="showcase__dialog-room" ref={setRoom}>
      <DialogRoom room={room}>
        <div className="showcase__dialog-room-floor">
          <TextButton onClick={() => setOpen(true)}>
            {dismissable ? 'Open the settings…' : 'Sign out…'}
          </TextButton>
          <p className="ui-label showcase__said">{said}</p>
        </div>
        <Dialog
          open={open}
          onClose={() => answer('put away')}
          dismissable={dismissable}
          title={dismissable ? 'Settings' : 'Signed out'}
          actions={
            dismissable ? (
              <TextButton onClick={() => answer('done')}>Done</TextButton>
            ) : (
              <>
                <TextButton face="secondary" onClick={() => answer('played as a guest')}>
                  Play as a guest
                </TextButton>
                <TextButton onClick={() => answer('signed in')}>Sign in</TextButton>
              </>
            )
          }
        >
          <p className="ui-body">
            {dismissable
              ? 'Over the room alone, and as wide as it has room for. Escape, the close mark or a press on the dimmed room puts it away.'
              : 'Nothing puts it away but an answer: Escape and a press on the dimmed room do nothing.'}
          </p>
        </Dialog>
      </DialogRoom>
    </div>
  );
}
