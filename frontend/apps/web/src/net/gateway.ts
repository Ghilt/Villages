import {
  NOTHING_IN_FLIGHT,
  answered,
  connect,
  ensurePlayerToken,
  follower,
  forgetPlayerToken,
  goingOut,
} from '@villages/client-core';
import type { Connection, HousesState, InFlight, Outgoing } from '@villages/client-core';
import { NO_HOUSES, reduceHouses } from '@villages/client-core';
import { PROTOCOL_VERSION } from '@villages/protocol';
import type {
  ChoiceView,
  CommandPayload,
  DialogueView,
  KeyFigureView,
  OptionView,
  ServerFrame,
  VisionPointView,
  YourHouseView,
} from '@villages/protocol';

import { note } from '../log/log';
import { chosenMaster } from '../map/masters';
import { followStandsUnder, standsArrived } from '../sprites/scenery/standsFromServer';
import { GATEWAY_URL } from './address';
import { browserSocket } from './browserSocket';

/**
 * The one connection to the gateway, and what it has heard: the events, for the debug panel, and the
 * houses in the cells being followed, for the map. Frames go to the debug log as they happen. See
 * decision records 0023, 0024 and 0026.
 */

export interface GatewayState {
  connection: 'connecting' | 'open' | 'closed' | 'takenOver';
  playerId?: string;
  /** The player's own house and what only they can see of it, or null when they have none. */
  yourHouse: YourHouseView | null;
  /** What this player has to decide, or null when they have nothing. What the parchment shows. */
  yourChoice: ChoiceView | null;
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
  /** The id of the command in flight, so the parchment can stop taking a second answer. */
  acting: string | null;
  houses: HousesState;
  /** Where the world's clock stands, as welcome said, or null until it has. */
  world: { today: number; earliest: number } | null;
  playerToken: string;
}

let state: GatewayState = {
  connection: 'connecting',
  yourHouse: null,
  yourChoice: null,
  yourKeyFigures: null,
  yourSight: null,
  yourDialogues: null,
  stepRefused: null,
  acting: null,
  houses: NO_HOUSES,
  world: null,
  playerToken: '',
};
const listeners = new Set<() => void>();
let connection: Connection | null = null;
/** Whether the switch is on, so a reconnection sets significance aside again before asking for a cell. */
let everything = false;
/** Whether the fog of war holds back what the house cannot see, so a reconnection lifts it again if not. */
let fogged = true;
/**
 * The commands waiting on their answers: the player's one, and where each was asked from, so its answer is filed
 * beside the line that asked. See `goingOut` in the client core.
 */
let inFlight: InFlight = NOTHING_IN_FLIGHT;

/** The steps through a dialogue in flight, by command, so a refusal can say which line it refused. */
const stepsOut = new Map<string, { dialogueId: string; lineId: string }>();

/**
 * Sends a command the one way commands go, minting its id, and says so in the part of the log it was asked from.
 * A player's command waits for the one before it to be answered; a lever does not. The id, or null when it may
 * not go. `alsoNow` is what changes with a player's command going, beside `acting`.
 */
function issue(out: Outgoing, alsoNow: Partial<GatewayState> = {}): string | null {
  const commandId = crypto.randomUUID();
  const going = goingOut(inFlight, connection !== null && state.connection === 'open', commandId, out);
  if (going === null || connection === null) {
    return null;
  }
  inFlight = going.inFlight;
  if (out.lane === 'player') {
    update({ acting: commandId, ...alsoNow });
  }
  note(going.area, going.line);
  connection.send(going.frame);
  return commandId;
}

/** The cells the camera wants, followed and let go of late: see `follower` in the client core. */
const following = follower({
  send: (frame) => connection?.send(frame),
  canSend: () => connection !== null && state.connection === 'open',
  houses: () => state.houses,
  setHouses: (houses) => update({ houses }),
  followStands: followStandsUnder,
  note,
  schedule: {
    after: (ms, run) => {
      const timer = setTimeout(run, ms);
      return () => clearTimeout(timer);
    },
  },
});

function update(change: Partial<GatewayState>): void {
  state = { ...state, ...change };
  for (const listener of listeners) listener();
}

/**
 * What listens to the conversation without taking part in it: the log, `sessionLog.ts` at the root. It is told
 * when the page connects, when the connection closes, and of a problem with a frame; and of every frame once the
 * state has taken it in, with the state as it was before, but before whatever the frame makes the page do, and
 * again once that is done. A command's answer comes with the part of the log its asking was filed in.
 */
export interface GatewayListener {
  connecting?(url: string): void;
  closed?(): void;
  problem?(problem: string): void;
  heard?(frame: ServerFrame, was: GatewayState, now: GatewayState, answeredIn: string | null): void;
  done?(frame: ServerFrame): void;
}

const listening = new Set<GatewayListener>();

/** Listens to the conversation from now on, until the function it hands back is called. */
export function observeGateway(listener: GatewayListener): () => void {
  listening.add(listener);
  return () => {
    listening.delete(listener);
  };
}

function tell(frame: ServerFrame, was: GatewayState, answeredIn: string | null = null): void {
  for (const listener of listening) listener.heard?.(frame, was, state, answeredIn);
}

/** Takes a frame in: the state first, then the listeners are told, then what the frame makes the page do. */
function heard(frame: ServerFrame): void {
  const was = state;
  switch (frame.type) {
    case 'welcome':
      update({ connection: 'open', playerId: frame.playerId, world: frame.world });
      tell(frame, was);
      // The eye and the fog first, because they decide what a snapshot carries and the cells are asked for next.
      sendEye();
      sendFog();
      // Anything the camera wanted before the gateway was listening is asked for now.
      following.welcomed();
      break;
    case 'snapshot':
      update({ houses: reduceHouses(state.houses, frame) });
      tell(frame, was);
      following.answered(frame.cell);
      break;
    case 'stands':
      // What the scenery grows from, as far as the fog lets it through. See decision record 0067.
      standsArrived(frame.x, frame.y, frame.stands);
      tell(frame, was);
      break;
    case 'batch':
      update({ houses: reduceHouses(state.houses, frame) });
      tell(frame, was);
      break;
    case 'resync':
      update({ houses: reduceHouses(state.houses, frame) });
      tell(frame, was);
      // The gateway let these go. Asking again is what gets fresh snapshots.
      connection?.send({ type: 'subscribeCells', cells: frame.cells });
      break;
    case 'commandAccepted':
    case 'commandRejected': {
      const answer = answered(inFlight, frame.commandId);
      inFlight = answer.inFlight;
      // A step the house would not take is said in its pane, under the options, as well as in the log.
      const step = stepsOut.get(frame.commandId);
      stepsOut.delete(frame.commandId);
      if (frame.type === 'commandRejected' && step !== undefined) {
        update({ stepRefused: { ...step, reason: frame.reason } });
      }
      if (state.acting === frame.commandId) update({ acting: null });
      tell(frame, was, answer.area);
      break;
    }
    case 'error':
      tell(frame, was);
      if (frame.code === 'tooManyCells' || frame.code === 'badCell') {
        // The whole subscription was refused. Put the connection back the way it was, or the map goes
        // blank and stays blank however far it is panned. See the follower's `refused`.
        following.refused(`the gateway refused ${frame.code}`);
      }
      break;
    case 'pong':
      tell(frame, was);
      break;
    case 'yourHouse':
      update({ yourHouse: frame.yours });
      tell(frame, was);
      break;
    case 'yourChoice':
      update({ yourChoice: frame.choice });
      tell(frame, was);
      break;
    case 'yourKeyFigures':
      update({ yourKeyFigures: frame.keyFigures });
      tell(frame, was);
      break;
    case 'yourSight':
      update({ yourSight: { points: frame.points, tension: frame.tension } });
      tell(frame, was);
      break;
    case 'yourDialogues':
      update({ yourDialogues: frame.dialogues });
      tell(frame, was);
      break;
    case 'worldWiped':
      tell(frame, was);
      // The world this window was looking at is gone. Arriving anew is the only honest thing to do, and
      // a reload is how a page arrives. See decision record 0036.
      window.location.reload();
      break;
    case 'takenOver':
      // A player plays from one place. This window is finished; the socket goes with it. See 0028.
      following.forget();
      update({
        connection: 'takenOver',
        houses: NO_HOUSES,
        yourHouse: null,
        yourChoice: null,
        yourKeyFigures: null,
        yourSight: null,
        yourDialogues: null,
      });
      tell(frame, was);
      connection?.close();
      break;
    case 'event': // A player's window never asks for stored events; they have a page of their own (0023).
      return;
    default:
      return frame satisfies never; // Every frame has a case above, so a new one does not compile until it has.
  }
  for (const listener of listening) listener.done?.(frame);
}

function sendEye(): void {
  if (connection === null || state.connection !== 'open' || !everything) {
    return;
  }
  connection.send({ type: 'seeAll', on: true });
}

function sendFog(): void {
  if (connection === null || state.connection !== 'open' || fogged) {
    return;
  }
  connection.send({ type: 'fogOfWar', on: false });
}

/**
 * Lifts the fog of war on this connection or lets it fall again: lifted, the gateway sends what the house
 * cannot see as well as what it can, and answers every held cell again. Safe before the gateway has answered
 * hello; the welcome lifts it. On at every load, as the drawing is. See decision record 0061.
 */
export function fogOfWar(on: boolean): void {
  fogged = on;
  if (connection === null || state.connection !== 'open') {
    return;
  }
  connection.send({ type: 'fogOfWar', on });
}

/**
 * Opens or closes the eye on this connection: with it open the gateway sets significance aside and every
 * house in a held cell is sent, however far back the camera is. Safe before the gateway has answered
 * hello; the welcome opens it. See decision record 0038.
 */
export function seeAll(on: boolean): void {
  everything = on;
  if (connection === null || state.connection !== 'open') {
    return;
  }
  connection.send({ type: 'seeAll', on });
}

/**
 * Follows the camera: the cells covering the view, at the view's own zoom, are what the map draws. Safe to
 * call before the gateway has answered hello; the request waits for the welcome.
 */
export function follow(cells: string[]): void {
  following.follow(cells);
}

/** Connects once, the first time anything asks. */
export function gateway(): Connection {
  if (connection !== null) return connection;

  const playerToken = ensurePlayerToken(
    { get: (key) => localStorage.getItem(key), set: (key, value) => localStorage.setItem(key, value) },
    () => crypto.randomUUID(),
  );
  update({ playerToken });
  for (const listener of listening) listener.connecting?.(GATEWAY_URL);

  const socket = browserSocket(GATEWAY_URL);
  socket.onClose(() => {
    // A window that was taken over closed its own socket on purpose. Saying "the connection closed, is
    // the backend running?" over the top of that would be the panel telling a plain lie; see 0023.
    if (state.connection === 'takenOver') {
      return;
    }
    following.forget();
    // No answer to anything in flight is coming now, so nothing is filed for one.
    inFlight = { ...inFlight, areas: new Map() };
    stepsOut.clear();
    update({ connection: 'closed', houses: NO_HOUSES });
    for (const listener of listening) listener.closed?.();
  });
  // Not watching events: those are read on their own page, which watches without playing. See 0023.
  // The master the page draws, so the gateway sends that world's stands and no other. See 0067.
  connection = connect({ socket, playerToken, protocolVersion: PROTOCOL_VERSION, master: chosenMaster() });
  connection.onFrame(heard);
  connection.onProblem((problem) => {
    for (const listener of listening) listener.problem?.(problem);
  });
  return connection;
}

/** Empties the development world, for everyone connected to it. A debug affordance; see 0036. */
export function wipeWorld(): void {
  if (connection === null || state.connection !== 'open') {
    return;
  }
  note('world', 'emptying the world');
  connection.send({ type: 'wipeWorld' });
}

/**
 * Takes one option of the choice this player has, and says so in the log.
 *
 * Which story this continues is not sent: the server reads it from the choice, because a client cannot
 * name a story that is not its own. See decision record 0035.
 */
export function takeOption(choice: ChoiceView, option: OptionView): void {
  issue({
    lane: 'player',
    area: 'command',
    what: `taking "${option.label}"`,
    command: { type: 'takeAction', choiceId: choice.id, optionId: option.id },
  });
}

/**
 * Sends one of the debug panel's levers as a real command, and says so in the part of the log it belongs to.
 *
 * Every one is told its answer the way anything else is: an accepted or a rejected frame, filed in the
 * same part of the log as the asking, and then the thing itself coming back changed. Nothing is assumed
 * here - the number on the card moves when the world says it did.
 */
export function pull(area: string, what: string, command: CommandPayload): void {
  issue({ lane: 'lever', area, what, command });
}

/**
 * Takes a step through one of the house's dialogues, from its pane: an option of a dialogue choice, or the line
 * the stretch read ends on, by its id.
 *
 * A player's command, as taking an option of a choice is, so nothing else is sent until it is answered and
 * the pane presses nothing meanwhile. Whether it is the next step is the house's to say, and a refusal comes
 * back as one, so nothing here checks. See decision record 0071.
 */
export function completeDialogueStep(dialogueId: string, lineId: string, described: string): void {
  // A new step is a new answer to wait for, so the last refusal is no longer the thing to say.
  const commandId = issue(
    {
      lane: 'player',
      area: 'dialogues',
      what: `taking ${described}`,
      command: { type: 'completeDialogueStep', dialogueId, lineId },
    },
    { stepRefused: null },
  );
  if (commandId !== null) {
    stepsOut.set(commandId, { dialogueId, lineId });
  }
}

/**
 * Starts over as a new player: forgets who this browser was and reloads.
 *
 * The house the old player founded stays in the world as somebody's, because events are never deleted.
 * A reload rather than a fresh socket, because a page carries the old player in more places than the
 * connection: the houses it holds, the day it is looking at, what it thinks its house is. See 0036.
 */
export function restart(): void {
  forgetPlayerToken({
    get: (key) => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
  });
  note('player', 'starting over as somebody new');
  window.location.reload();
}

export function gatewayState(): GatewayState {
  return state;
}

export function watchGateway(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
