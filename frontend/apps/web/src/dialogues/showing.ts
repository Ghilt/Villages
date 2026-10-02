import type { DialogueView, LineView, ShowsView } from '@villages/protocol';

import { note } from '../log/log';
import { focusOn } from '../map/focus';
import { sessionStore } from '../net/gateway';
import { showsWords } from './describe';

/**
 * What a dialogue shows beside itself: the map, and a window on a house or a person. Handed down from the pane,
 * whose room knows which bay is beside it, rather than reached for. See `panes.tsx`.
 */
export interface Beside {
  showMap(): void;
  window(thing: { kind: 'house' | 'character'; id: string }): void;
}

/**
 * A line that shows something, as it is reached while playing: the camera taken to a place, or a window
 * opened on a house or a character.
 *
 * The policy that joins a conversation to the map and the windows, as `opening.ts` joins a dialogue arriving
 * to the bays: the reading place says which lines are showing, the bay manager says what is where, and what
 * a line about the quay should do with the map is neither's business. See `MECHANICS.md` and decision record
 * 0071.
 */

/** A line reached while playing that shows something, and what it shows. */
export interface Reached {
  readonly key: string;
  readonly line: string;
  readonly shows: ShowsView;
}

/**
 * The lines among these that show something and have not shown it yet. It remembers every one it is shown,
 * so a line shows its thing once in the life of the page: going back to the list and opening the
 * conversation again shows nothing twice.
 */
export function newlyReached(
  seen: Set<string>,
  dialogueId: string,
  lines: readonly Pick<LineView, 'id' | 'shows'>[],
): readonly Reached[] {
  const reached: Reached[] = [];
  for (const line of lines) {
    const key = `${dialogueId}/${line.id}`;
    if (line.shows === undefined || seen.has(key)) {
      continue;
    }
    seen.add(key);
    reached.push({ key, line: line.id, shows: line.shows });
  }
  return reached;
}

/** Every line this page has shown the thing of, for the life of the page. A reload is a new page. */
const shown = new Set<string>();

/** The options taken here that show something, until the house has written them down. */
const taken = new Map<string, { readonly dialogueId: string; readonly line: LineView }>();

/**
 * A step being sent. An option that shows something shows it once the house has taken it rather than as it
 * is pressed, because the house can refuse it - a purse too light - and then nothing was said.
 */
export function taking(dialogueId: string, line: LineView): void {
  if (line.shows !== undefined) {
    taken.set(`${dialogueId}/${line.id}`, { dialogueId, line });
  }
}

/**
 * Show what the lines reached in a conversation show: the stretch showing, and an option taken once it is
 * among what has been said. A line said before the page was playing shows nothing, because a line said is
 * sent without what it shows, which is how a dialogue read back shows nothing, Adam's call.
 */
export function showWhatIsReached(
  dialogue: DialogueView,
  showingLines: readonly LineView[],
  beside: Beside,
): void {
  const said = new Set(dialogue.said.map((line) => line.id));
  const answered: LineView[] = [];
  for (const [key, one] of taken) {
    if (one.dialogueId === dialogue.id && said.has(one.line.id)) {
      answered.push(one.line);
      taken.delete(key);
    }
  }
  for (const reached of newlyReached(shown, dialogue.id, [...answered, ...showingLines])) {
    show(reached, dialogue, beside);
  }
}

/**
 * Show one thing. In the spread everything is on the screen, so the camera moves beside the conversation, or
 * the window opens in the rail as a click on the map would open it. On a phone the other bay shows it - the
 * map for a place, the window for a house or a character - and the two go to half each when the
 * conversation had the stage, Adam's word: the conversation stays beside what it is about, as a window's link
 * to the map leaves the window beside the map.
 */
function show(reached: Reached, dialogue: DialogueView, beside: Beside): void {
  const yours = sessionStore.get().yourHouse?.house ?? null;
  note(
    'dialogues',
    `"${dialogue.title}": "${reached.line}" shows ${showsWords(reached.shows, dialogue, yours)}`,
  );

  const { shows } = reached;
  if (shows.kind === 'place') {
    focusOn(shows.at);
    beside.showMap();
    return;
  }
  beside.window({ kind: shows.kind, id: shows.id });
}
