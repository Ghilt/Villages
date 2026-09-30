import { useCallback, useState } from 'react';

/**
 * The page's own switches, remembered by this browser so a reload finds the page as it was left.
 *
 * Only conveniences are kept here. The storage can be missing or refuse, in a private window or with site
 * data cleared, and the page is then simply as it opens.
 */

export type Width = 'desktop' | 'phone';
export type Ground = 'night' | 'parchment';
export type Layers = 'hidden' | 'shown';

export interface Settings {
  /** How wide the sheet the components stand on is: the whole window, or a phone's 390 pixels. */
  readonly width: Width;
  /** What the components stand on. */
  readonly ground: Ground;
  /** Whether a container's layers are drawn: the room its keep-outs take, and its embellishments' boxes. */
  readonly layers: Layers;
}

const KEY = 'villages.showcase';

const OPENS_AS: Settings = { width: 'desktop', ground: 'night', layers: 'hidden' };

function remembered(): Settings {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    return {
      width: kept?.width === 'phone' ? 'phone' : OPENS_AS.width,
      ground: kept?.ground === 'parchment' ? 'parchment' : OPENS_AS.ground,
      layers: kept?.layers === 'shown' ? 'shown' : OPENS_AS.layers,
    };
  } catch {
    return OPENS_AS;
  }
}

export function useSettings(): [Settings, (change: Partial<Settings>) => void] {
  const [settings, setSettings] = useState(remembered);
  const change = useCallback((given: Partial<Settings>) => {
    setSettings((was) => {
      const now = { ...was, ...given };
      try {
        localStorage.setItem(KEY, JSON.stringify(now));
      } catch {
        // Not remembered, which costs a click after the next reload and nothing else.
      }
      return now;
    });
  }, []);
  return [settings, change];
}
