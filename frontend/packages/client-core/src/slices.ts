import type {
  ChoiceView,
  DialogueView,
  InspectedFrame,
  KeyFigureView,
  RollDrawnFrame,
  ServerFrame,
  VisionPointView,
  YourHouseView,
} from '@villages/protocol';

import { NO_HOUSES, reduceHouses } from './houses';
import type { HousesState } from './houses';

/** What the page knows of the world and of its own house, as the gateway has told it. */
export interface SessionState {
  connection: 'connecting' | 'open' | 'closed' | 'takenOver';
  playerId?: string;
  /** The player's own house and what only they can see of it, or null when they have none. */
  yourHouse: YourHouseView | null;
  /** What this player has to decide, or null when they have nothing. What the parchment shows. */
  yourChoice: ChoiceView | null;
  /**
   * What this window's last roll drew from - the pools it opened, what was in the draw and how heavily - or null
   * until one is told. Only ever sent while the instruments are open, and only the debug panel reads it. See 0083.
   */
  rollDrawn: RollDrawnFrame | null;
  /**
   * The player's living key figures, in the order they joined the house, or null until the gateway has
   * said. An empty list is a house with none; null is not having heard yet. See decision record 0055.
   */
  yourKeyFigures: readonly KeyFigureView[] | null;
  /**
   * Every vision point the player's house has had, oldest first, and the surface tension of the edge in
   * kilometres, or null until the gateway has said. What the fog of war is drawn from: vision is the points
   * lasting today, revealed is all of them, each with the gaps between close circles filled. See 0061, 0064.
   */
  yourSight: { points: readonly VisionPointView[]; tension: number } | null;
  /**
   * The player's dialogues, open and finished, as the gateway lets them be known, or null until it has said.
   * What has not been reached is never here, and nor is any requirement. See decision record 0071.
   */
  yourDialogues: readonly DialogueView[] | null;
  /**
   * The last step through a dialogue the house refused, and why, until another is sent: which the pane says
   * under the options, because a press that seems to do nothing is a press the player cannot read.
   */
  stepRefused: { dialogueId: string; lineId: string; reason: string } | null;
  /** The step through a dialogue waiting on its answer, so a refusal can say which line it refused. */
  stepping: { commandId: string; dialogueId: string; lineId: string } | null;
  /** The id of the player's command in flight, so the panes stop taking a second answer. */
  acting: string | null;
  houses: HousesState;
  /** Where the world's clock stands, as welcome said, or null until it has. */
  world: { today: number; earliest: number } | null;
  playerToken: string;
  /**
   * Whether this window has asked to see everything: every house in the cells it holds, whatever its
   * significance, which is Adam's switch and not the player's eye. Off at every load. See decision record 0038.
   */
  seeAll: boolean;
  /** Whether the fog of war is on in this window, drawn and held back alike. On at every load. See 0061. */
  fogOfWar: boolean;
  /**
   * The last answer to what water the page pointed at, until another comes, or null before any: whether the house
   * has revealed the place, and the water there by name. What an inspect window on water is opened from. See 0087.
   */
  inspected: InspectedFrame | null;
}

/**
 * What ends the session's hold on the world: the connection going, or another window taking the player over. The
 * two differ on purpose: a closed connection keeps what the house had on its cards, for whoever reads them after,
 * and a window taken over forgets it, because somebody else is playing it now. See decision record 0028.
 */
export type EndCause = 'closed' | 'takenOver';

export type FrameType = ServerFrame['type'];
export type FrameOf<T extends FrameType> = Extract<ServerFrame, { type: T }>;

/**
 * One mechanic's part of the session's state: what it starts as, how each frame it cares about changes it, and
 * what an end of the session does to it. Pure: a part never sends, waits or says anything.
 */
export interface Slice<K extends keyof SessionState> {
  readonly initial: Pick<SessionState, K>;
  readonly onFrame: {
    readonly [T in FrameType]?: (state: Pick<SessionState, K>, frame: FrameOf<T>) => Pick<SessionState, K>;
  };
  onReset(state: Pick<SessionState, K>, cause: EndCause): Pick<SessionState, K>;
}

/** A part that keeps its state through a close, and forgets it to a takeover. */
const forgottenWhenTakenOver =
  <K extends keyof SessionState>(initial: Pick<SessionState, K>) =>
  (state: Pick<SessionState, K>, cause: EndCause): Pick<SessionState, K> =>
    cause === 'takenOver' ? initial : state;

const SLICES = {
  connection: {
    initial: { connection: 'connecting', playerId: undefined, world: null, playerToken: '' },
    onFrame: {
      welcome: (state, frame) => ({
        ...state,
        connection: 'open',
        playerId: frame.playerId,
        world: frame.world,
      }),
    },
    onReset: (state, cause) => ({ ...state, connection: cause }),
  } satisfies Slice<'connection' | 'playerId' | 'world' | 'playerToken'>,

  /** The cells followed and what is in them, which the map draws. Gone with any end: nobody is updating them. */
  cells: {
    initial: { houses: NO_HOUSES },
    onFrame: {
      snapshot: (state, frame) => ({ houses: reduceHouses(state.houses, frame) }),
      batch: (state, frame) => ({ houses: reduceHouses(state.houses, frame) }),
      resync: (state, frame) => ({ houses: reduceHouses(state.houses, frame) }),
    },
    onReset: () => ({ houses: NO_HOUSES }),
  } satisfies Slice<'houses'>,

  house: {
    initial: { yourHouse: null },
    onFrame: { yourHouse: (_, frame) => ({ yourHouse: frame.yours }) },
    onReset: forgottenWhenTakenOver({ yourHouse: null }),
  } satisfies Slice<'yourHouse'>,

  choice: {
    initial: { yourChoice: null },
    onFrame: { yourChoice: (_, frame) => ({ yourChoice: frame.choice }) },
    onReset: forgottenWhenTakenOver({ yourChoice: null }),
  } satisfies Slice<'yourChoice'>,

  rolls: {
    initial: { rollDrawn: null },
    onFrame: { rollDrawn: (_, frame) => ({ rollDrawn: frame }) },
    onReset: forgottenWhenTakenOver({ rollDrawn: null }),
  } satisfies Slice<'rollDrawn'>,

  keyFigures: {
    initial: { yourKeyFigures: null },
    onFrame: { yourKeyFigures: (_, frame) => ({ yourKeyFigures: frame.keyFigures }) },
    onReset: forgottenWhenTakenOver({ yourKeyFigures: null }),
  } satisfies Slice<'yourKeyFigures'>,

  sight: {
    initial: { yourSight: null },
    onFrame: { yourSight: (_, frame) => ({ yourSight: { points: frame.points, tension: frame.tension } }) },
    onReset: forgottenWhenTakenOver({ yourSight: null }),
  } satisfies Slice<'yourSight'>,

  dialogues: {
    initial: { yourDialogues: null },
    onFrame: { yourDialogues: (_, frame) => ({ yourDialogues: frame.dialogues }) },
    onReset: forgottenWhenTakenOver({ yourDialogues: null }),
  } satisfies Slice<'yourDialogues'>,

  /**
   * The player's command waiting on its answer, and a step refused. A refusal of the step out is said in its pane,
   * under the options, as well as in the log. A close forgets the step out, whose answer is not coming; nothing
   * else ends either, as it never has.
   */
  commands: {
    initial: { acting: null, stepRefused: null, stepping: null },
    onFrame: {
      commandAccepted: (state, frame) => ({
        acting: state.acting === frame.commandId ? null : state.acting,
        stepRefused: state.stepRefused,
        stepping: state.stepping?.commandId === frame.commandId ? null : state.stepping,
      }),
      commandRejected: (state, frame) => {
        const step = state.stepping?.commandId === frame.commandId ? state.stepping : null;
        return {
          acting: state.acting === frame.commandId ? null : state.acting,
          stepRefused:
            step === null
              ? state.stepRefused
              : { dialogueId: step.dialogueId, lineId: step.lineId, reason: frame.reason },
          stepping: step === null ? state.stepping : null,
        };
      },
    },
    onReset: (state, cause) => (cause === 'closed' ? { ...state, stepping: null } : state),
  } satisfies Slice<'acting' | 'stepRefused' | 'stepping'>,

  /**
   * The two ways of looking the window has asked for, held here and nowhere else: what the map draws reads them,
   * and the gateway is told them again at every welcome. A way of looking rather than a fact of the world, so no
   * frame changes them and no end forgets them.
   */
  /** What the page last pointed at, as the server answered. Forgotten to a takeover, like what the house was told. */
  places: {
    initial: { inspected: null },
    onFrame: { inspected: (_, frame) => ({ inspected: frame }) },
    onReset: forgottenWhenTakenOver({ inspected: null }),
  } satisfies Slice<'inspected'>,

  switches: {
    initial: { seeAll: false, fogOfWar: true },
    onFrame: {},
    onReset: (state) => state,
  } satisfies Slice<'seeAll' | 'fogOfWar'>,
};

const PARTS: readonly Slice<keyof SessionState>[] = Object.values(SLICES) as unknown as Slice<
  keyof SessionState
>[];

/** The session's state as every part starts it. */
export const INITIAL_SESSION: SessionState = Object.assign(
  {},
  ...PARTS.map((part) => part.initial),
) as SessionState;

/** What a part keeps, out of the whole. */
function partOf<K extends keyof SessionState>(part: Slice<K>, state: SessionState): Pick<SessionState, K> {
  const kept = {} as Pick<SessionState, K>;
  for (const key of Object.keys(part.initial) as K[]) {
    kept[key] = state[key];
  }
  return kept;
}

/** The state after a frame: every part that cares about it, in turn. */
export function foldFrame(state: SessionState, frame: ServerFrame): SessionState {
  let next = state;
  for (const part of PARTS) {
    const fold = part.onFrame[frame.type] as
      ((kept: Partial<SessionState>, frame: ServerFrame) => Partial<SessionState>) | undefined;
    if (fold !== undefined) {
      next = { ...next, ...fold(partOf(part, next), frame) };
    }
  }
  return next;
}

/** The state after the session ends, as each part ends. */
export function endState(state: SessionState, cause: EndCause): SessionState {
  let next = state;
  for (const part of PARTS) {
    next = { ...next, ...part.onReset(partOf(part, next), cause) };
  }
  return next;
}
