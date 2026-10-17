import { createSession, ensurePlayerToken, forgetPlayerToken } from '@villages/client-core';
import type { Connection, Looking, Readable, SessionListener, SessionState } from '@villages/client-core';
import { PROTOCOL_VERSION } from '@villages/protocol';
import type { ChoiceView, CommandPayload, OptionView, Point } from '@villages/protocol';

import { note } from '../log/log';
import { followStandsUnder, standsArrived } from './stands';
import { GATEWAY_URL } from './address';
import { browserSocket } from './browserSocket';

/**
 * The one connection to the gateway, in the browser: the client core's session - what the page knows of the
 * world, folded from what each mechanic folds, the cells it follows, its commands and its two switches - wired to
 * the browser's socket, timers, storage and reload. Everything the session does is the client core's and tested
 * there and in `gateway.test.ts`; what is here is only where a browser keeps things. See decision records 0023,
 * 0024, 0026 and 0078.
 */

export type GatewayState = SessionState;
export type GatewayListener = SessionListener;

const session = createSession({
  schedule: {
    after: (ms, run) => {
      const timer = setTimeout(run, ms);
      return () => clearTimeout(timer);
    },
  },
  newId: () => crypto.randomUUID(),
  standsArrived,
  followStands: followStandsUnder,
  arriveAnew: () => window.location.reload(),
  note,
});

/** What the page knows of the world, for whatever draws it: read in a component through `useStore`. */
export const sessionStore: Readable<SessionState> = { get: session.state, watch: session.watch };

let connection: Connection | null = null;

/** The browser's storage, where who this browser plays as is kept. See `identity.ts` in the client core. */
const tokens = {
  get: (key: string) => localStorage.getItem(key),
  set: (key: string, value: string) => localStorage.setItem(key, value),
};

/**
 * Connects once, the first time anything asks, to draw `master`: said in hello, so the gateway sends that
 * world's stands and no other. See decision record 0067. Not watching events: those are read on their own page,
 * which watches without playing. See 0023.
 */
export function gateway(master: string): Connection {
  if (connection !== null) return connection;
  connection = session.connect({
    socket: browserSocket(GATEWAY_URL),
    playerToken: ensurePlayerToken(tokens, () => crypto.randomUUID()),
    protocolVersion: PROTOCOL_VERSION,
    master,
    address: GATEWAY_URL,
  });
  return connection;
}

/**
 * Follows the camera: the cells covering the view, at the view's own zoom, are what the map draws. Safe to
 * call before the gateway has answered hello; the request waits for the welcome.
 */
export function follow(cells: string[]): void {
  session.follow(cells);
}

/**
 * Lets the fog of war fall on this connection or lifts it: lifted, the gateway sends what the house cannot see
 * as well as what it can, and answers every held cell again, and nothing is drawn over the map. Held once, in
 * the session, which the drawing reads. Safe before the gateway has answered hello; the welcome says it again.
 * On at every load. See decision record 0061.
 */
export function fogOfWar(on: boolean): void {
  session.fogOfWar(on);
}

/**
 * Sees everything on this connection, or stops: the gateway sets significance aside and every house in a held
 * cell is sent, however far back the camera is, and the renderer's floor comes off with it. Adam's switch, not
 * the player's eye. Held once, in the session. Safe before the gateway has answered hello; the welcome says it
 * again. See decision record 0038.
 */
export function seeAll(on: boolean): void {
  session.seeAll(on);
}

/**
 * Asks the server what water is at a place on the map, which a click that hit no house, person or area does. The
 * answer comes back into the session as `inspectedAt`, named only on ground the house has revealed. See 0087.
 */
export function inspectAt(at: Point): void {
  session.inspectAt(at);
}

/** Empties the development world, for everyone connected to it. A debug affordance; see 0036. */
export function wipeWorld(): void {
  session.wipeWorld();
}

/** Saves the development world under a name, beside every tree, so any tree can load it. See decision record 0101. */
export function saveWorld(name: string): void {
  session.saveWorld(name);
}

/**
 * Takes one option of the choice this player has, and says so in the log.
 *
 * Which story this continues is not sent: the server reads it from the choice, because a client cannot
 * name a story that is not its own. See decision record 0035.
 */
export function takeOption(choice: ChoiceView, option: OptionView): void {
  session.takeOption(choice, option);
}

/**
 * Take action: rolls for a hand, saying what the page is looking at, which the root gathers. A player's command,
 * so nothing else of the player's goes until it is answered. See decision record 0083.
 */
export function takeAction(looking: Looking): void {
  session.roll(looking);
}

/**
 * Sends one of the debug panel's levers as a real command, and says so in the part of the log it belongs to.
 *
 * Every one is told its answer the way anything else is: an accepted or a rejected frame, filed in the
 * same part of the log as the asking, and then the thing itself coming back changed. Nothing is assumed
 * here - the number on the card moves when the world says it did.
 */
export function pull(area: string, what: string, command: CommandPayload): void {
  session.pull(area, what, command);
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
  session.completeDialogueStep(dialogueId, lineId, described);
}

/**
 * Meets an objective of the node a quest stands at, from its pane, and collects a reward: the player's own commands,
 * so nothing else is sent until each is answered. Whether the house can pay is the house's to say, and a refusal
 * comes back as one. See decision record 0096.
 */
export function meetObjective(questId: string, nodeId: string, objectiveId: string, described: string): void {
  session.meetObjective(questId, nodeId, objectiveId, described);
}

export function collectReward(questId: string, nodeId: string, described: string): void {
  session.collectReward(questId, nodeId, described);
}

/**
 * Starts over as a new player: forgets who this browser was and reloads.
 *
 * The house the old player founded stays in the world as somebody's, because events are never deleted.
 * A reload rather than a fresh socket, because a page carries the old player in more places than the
 * connection: the houses it holds, the day it is looking at, what it thinks its house is. See 0036.
 */
export function restart(): void {
  forgetPlayerToken(tokens);
  note('player', 'starting over as somebody new');
  window.location.reload();
}

/**
 * Asks the gateway after a window's subject wherever the camera is, once a connection: what a window knowing
 * nothing of a house, a person or a structure does. The answer is the session's `inspected`. See decision record 0088.
 */
export function inspectSubject(kind: 'house' | 'character' | 'structure', id: string): void {
  session.inspect(kind, id);
}

/** Listens to the conversation from now on, until the function it hands back is called. See `SessionListener`. */
export function observeGateway(listener: GatewayListener): () => void {
  return session.observe(listener);
}
