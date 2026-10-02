import { useState } from 'react';

import { sceneUrl } from './scenes';

/**
 * **The scene**: where a conversation is happening, the whole of its pane, with the conversation over it.
 *
 * One of Adam's pictures, cropped to the pane rather than squeezed into it, so any landscape picture will do;
 * the bubbles, the options and the way on are drawn over it on paper of their own, so they read whatever is
 * behind them, and the speakers stand in it in their bubbles, facing each other from the two sides. Adam's
 * word: the scene is the entire pane and the bubbles are over it. A scene whose picture is not there, or will
 * not load, is the pane's own paper - never the browser's broken-image mark, which is the program talking
 * rather than the world. See `MECHANICS.md`.
 */
export function Scene({ scene }: { scene: string }) {
  // The key that failed, rather than a flag, so that another scene is given its own chance to load.
  const [failed, setFailed] = useState<string | null>(null);
  if (scene === failed) {
    return null;
  }
  return (
    <div className="dialogues__scene" aria-hidden="true">
      <img
        className="dialogues__picture"
        src={sceneUrl(scene)}
        alt=""
        draggable={false}
        onError={() => setFailed(scene)}
      />
    </div>
  );
}
