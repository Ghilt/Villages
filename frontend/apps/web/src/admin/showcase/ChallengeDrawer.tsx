import { useState } from 'react';
import type { CSSProperties } from 'react';

import { MarkButton } from '../../ui/button/Button';
import { Drawer } from '../../ui/drawer/Drawer';
import { Part, Specimen, Specimens } from './Specimen';

/** A stage to open a drawer over, as a challenge's diorama is one. */
const STAGE: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  border: '1px solid #3d3427',
  borderRadius: 4,
  background: 'linear-gradient(180deg, #c4b593, #d3c6a6)',
};

/** What a challenge's history holds, as the spectacle will fill it. */
function History() {
  return (
    <div className="ui-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{ margin: 0 }}>Second 26: Holy.</p>
      <p style={{ margin: 0 }}>Varga · Priest #4 pulls, ×1.5, weakened · +3.2</p>
      <p style={{ margin: 0 }}>Varga · the Cathedral of Varga pulls, ×1.5 · +1.5</p>
      <p style={{ margin: 0 }}>Brannock · the Forge at Hollin pulls · −1</p>
      <p style={{ margin: 0 }}>Varga · Endless Parley · +2</p>
    </div>
  );
}

/** A stage with its history mark and the drawer it opens. */
function Staged({ deep }: { deep: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...STAGE, width: deep ? 300 : 560, height: deep ? 470 : 320, maxWidth: '100%' }}>
      <div style={{ position: 'absolute', top: 8, right: 8 }}>
        <MarkButton label="The history" mark="history" pressed={open} onClick={() => setOpen(!open)} />
      </div>
      <Drawer title="History" open={open} onClose={() => setOpen(false)} from={deep ? 'bottom' : 'right'}>
        <History />
      </Drawer>
    </div>
  );
}

/** The drawer a challenge's history opens in, over its stage held both ways. */
export function ChallengeDrawer() {
  return (
    <Part title="The drawer">
      <p className="ui-label showcase__lead">
        What the history mark opens over the stage without leaving it: from the right of a stage held wide,
        from the bottom of one held deep, so it takes the longer side and leaves the rest to watch. In the{' '}
        <code>pane.drawer</code> recipe, which reads <code>world/ui/borders/gilt-thin</code> and{' '}
        <code>world/ui/fills/dark-felt</code>; nothing new to paint. Press the mark.
      </p>
      <Specimens>
        <Specimen name='Drawer from="right"' note="over a stage held wide" wide>
          <Staged deep={false} />
        </Specimen>
        <Specimen name='Drawer from="bottom"' note="over a stage held deep">
          <Staged deep />
        </Specimen>
      </Specimens>
    </Part>
  );
}
