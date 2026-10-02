import { connect, ensurePlayerToken, forgetPlayerToken } from '@villages/client-core';
import type { Connection, HousesState } from '@villages/client-core';
import {
  NO_HOUSES,
  cellsHeld,
  charactersInView,
  forgetCells,
  holdCells,
  reduceHouses,
  whatToFollow,
} from '@villages/client-core';
import { PROTOCOL_VERSION, describeDay } from '@villages/protocol';
import type {
  ChoiceView,
  CommandPayload,
  DialogueView,
  KeyFigureView,
  OptionView,
  Point,
  ResourceName,
  ServerFrame,
  StatName,
  VisionPointView,
  YourHouseView,
} from '@villages/protocol';

import { note, shortId } from '../log/log';
import { STAT_WORDS, fullName, whatChanged } from '../figures/describe';
import { whatChangedIn } from '../dialogues/describe';
import { describeSight } from '../fog/describe';
import { chosenMaster } from '../map/masters';
import { followStandsUnder, standsArrived } from '../sprites/scenery/standsFromServer';
import {
  NOTHING_ARRIVED,
  NO_STANDS_ARRIVED,
  alsoArrived,
  alsoStood,
  describeArrival,
  describeBatch,
  describeStands,
} from './arrivals';
import type { Arrival, StandsArrival } from './arrivals';
import { browserSocket } from './browserSocket';

/**
 * The one connection to the gateway, and what it has heard: the events, for the debug panel, and the
 * houses in the cells being followed, for the map. Frames go to the debug log as they happen. See
 * decision records 0023, 0024 and 0026.
 */

export const GATEWAY_URL =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ??
  `ws://localhost:${(import.meta.env.VITE_GAME_PORT as string | undefined) ?? '8080'}/ws`;

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
/** What the camera last asked for, so it can be asked for again once the gateway is listening. */
let wanted: string[] = [];
/** Whether the switch is on, so a reconnection sets significance aside again before asking for a cell. */
let everything = false;
/** Whether the fog of war holds back what the house cannot see, so a reconnection lifts it again if not. */
let fogged = true;
/**
 * Which part of the log each command in flight was asked from, so its answer is filed beside the line that
 * asked. Forgotten when it is answered, and all of it when the connection closes.
 */
const askedFrom = new Map<string, string>();

/** The steps through a dialogue in flight, by command, so a refusal can say which line it refused. */
const stepsOut = new Map<string, { dialogueId: string; lineId: string }>();

/** The part of the log a command's answer goes in: where it was asked from, or the gateway's own. */
function answerArea(commandId: string): string {
  const area = askedFrom.get(commandId) ?? 'gateway';
  askedFrom.delete(commandId);
  return area;
}

/**
 * How long the snapshots of one burst are gathered before they are said in a line.
 *
 * The same quarter second the gateway coalesces its deltas over, and for the same reason: a view is a
 * few dozen cells and each answers separately, so what is worth reading is the burst and not the frame.
 */
const GATHER_MS = 250;
let arriving: Arrival = NOTHING_ARRIVED;
let gathering: ReturnType<typeof setTimeout> | null = null;

/** The stands of one burst, gathered as the snapshots are and said once. See decision record 0067. */
let standing: StandsArrival = NO_STANDS_ARRIVED;
let gatheringStands: ReturnType<typeof setTimeout> | null = null;

/**
 * How long what is on the screen is kept after the gateway has been told to stop sending it.
 *
 * Only reached when a snapshot never comes. The cells are normally let go the moment the ones that
 * replace them have answered, which is a round trip rather than this.
 */
const HOLD_MS = 2000;

/**
 * Cells the gateway has been told to stop sending, whose houses are still drawn.
 *
 * Cell ids carry their zoom, so a step from one zoom to the next wants a different cell for the same
 * ground. Letting the old one go before the new one has answered empties the map for a round trip:
 * every house vanishes and every sprite with it. So what is held is let go late, and until then these
 * cells are held but no longer followed - drawn, and not asked about.
 */
let released = new Set<string>();
/** The cells of the last subscription, so that a refusal knows which ones are not coming. */
let askedFor: string[] = [];
/** The cells whose snapshots the release is waiting for. Empty means nothing is waiting. */
let awaiting = new Set<string>();
let holding: ReturnType<typeof setTimeout> | null = null;

/** Lets go of everything the gateway has stopped sending, and stops waiting for anything. */
function letGoNow(why: string): void {
  if (holding !== null) {
    clearTimeout(holding);
    holding = null;
  }
  awaiting = new Set();
  if (released.size === 0) {
    return;
  }
  const cells = [...released];
  released = new Set();
  note('cells', `let go of ${cells.length} cell${cells.length === 1 ? '' : 's'} ${why}`);
  update({ houses: forgetCells(state.houses, cells) });
}

/**
 * Puts back what a refused subscription undid.
 *
 * The gateway refuses a subscription whole, so not one of the cells asked for is coming. Held and never
 * sent, they would be held for ever: `whatToFollow` compares against what is held, so it would never
 * ask for them again and the map could not recover by being moved back. So they are forgotten.
 *
 * And what was let go to make room for them is asked for again, because the gateway was told to stop
 * sending it a moment ago and the thing meant to replace it never arrived. Without that the map keeps
 * drawing houses nobody is updating until the release timer empties it.
 */
function askAgainAfterARefusal(why: string): void {
  if (holding !== null) {
    clearTimeout(holding);
    holding = null;
  }
  awaiting = new Set();

  const refused = askedFor;
  askedFor = [];
  const back = [...released];
  released = new Set();

  if (refused.length > 0) {
    update({ houses: forgetCells(state.houses, refused) });
  }
  followStands();
  note('cells', `${why}: forgot ${refused.length} that never came, asking again for ${back.length}`);
  if (back.length > 0 && connection !== null && state.connection === 'open') {
    connection.send({ type: 'subscribeCells', cells: back });
  }
}

/**
 * Tells the scenery's stands which cells the gateway is following now, so that a tile it has let go of is let go
 * here too and coming back waits for it to be sent again. The cells held late are not followed: the gateway was
 * told to stop sending them. See decision record 0067.
 */
function followStands(): void {
  followStandsUnder(cellsHeld(state.houses).filter((cell) => !released.has(cell)));
}

/** Forgets that anything was being held late. For a connection that is starting or ending. */
function forgetTheHold(): void {
  if (holding !== null) {
    clearTimeout(holding);
    holding = null;
  }
  released = new Set();
  awaiting = new Set();
}

function update(change: Partial<GatewayState>): void {
  state = { ...state, ...change };
  for (const listener of listeners) listener();
}

function heard(frame: ServerFrame): void {
  switch (frame.type) {
    case 'welcome':
      update({ connection: 'open', playerId: frame.playerId, world: frame.world });
      note(
        'gateway',
        `welcome: player ${frame.playerId.slice(0, 8)}, server time ${new Date(frame.serverTime).toISOString()}`,
      );
      note(
        'world',
        `today is ${describeDay(frame.world.today)}; the earliest thing is from ${describeDay(frame.world.earliest)}`,
      );
      // The eye and the fog first, because they decide what a snapshot carries and the cells are asked for next.
      sendEye();
      sendFog();
      // Anything the camera wanted before the gateway was listening is asked for now.
      sendFollowing(wanted);
      return;
    case 'snapshot':
      update({ houses: reduceHouses(state.houses, frame) });
      // What replaces the released cells has arrived, so they can go now rather than on the timer.
      if (awaiting.delete(frame.cell) && awaiting.size === 0) {
        letGoNow('now that what replaces them has arrived');
      }
      gather(frame);
      return;
    case 'stands':
      // What the scenery grows from, as far as the fog lets it through. See decision record 0067.
      standsArrived(frame.x, frame.y, frame.stands);
      gatherStands(frame);
      return;
    case 'batch': {
      // Who was standing where before the batch, so that somebody gone can be named in the line.
      const known = new Map(charactersInView(state.houses).map((one) => [one.id, one]));
      update({ houses: reduceHouses(state.houses, frame) });
      note(
        'cells',
        describeBatch(frame.deltas, (id) => {
          const one = known.get(id);
          return one === undefined ? undefined : `${one.givenName} ${one.familyName}`;
        }),
      );
      return;
    }
    case 'resync':
      update({ houses: reduceHouses(state.houses, frame) });
      note('cells', `fell behind; asking again for ${frame.cells.length} cells`);
      // The gateway let these go. Asking again is what gets fresh snapshots.
      connection?.send({ type: 'subscribeCells', cells: frame.cells });
      return;
    case 'commandAccepted':
      stepsOut.delete(frame.commandId);
      if (state.acting === frame.commandId) update({ acting: null });
      note(answerArea(frame.commandId), `command ${shortId(frame.commandId)} accepted`);
      return;
    case 'commandRejected': {
      // A step the house would not take is said in its pane, under the options, as well as in the log.
      const step = stepsOut.get(frame.commandId);
      stepsOut.delete(frame.commandId);
      if (step !== undefined) {
        update({ stepRefused: { ...step, reason: frame.reason } });
      }
      if (state.acting === frame.commandId) update({ acting: null });
      note(answerArea(frame.commandId), `command ${shortId(frame.commandId)} rejected: ${frame.reason}`);
      return;
    }
    case 'error':
      note('gateway', `error ${frame.code}: ${frame.message}`);
      if (frame.code === 'tooManyCells' || frame.code === 'badCell') {
        // The whole subscription was refused. Put the connection back the way it was, or the map goes
        // blank and stays blank however far it is panned. See the note on `askAgainAfterARefusal`.
        askAgainAfterARefusal(`the gateway refused ${frame.code}`);
      }
      if (frame.code === 'protocolVersion') {
        // The one error whose cause is never in the code: a server left running from an older build.
        // Saying what to do here saves reading the message and guessing. See decision record 0037.
        note(
          'gateway',
          `this page speaks version ${PROTOCOL_VERSION}, so the server on the other end is a different ` +
            'build of the program. Stop it and start it again from this tree with debug-quick-start.ps1 -Stop.',
        );
      }
      return;
    case 'pong':
      note('gateway', `pong, round trip ${Date.now() - frame.t0} ms`);
      return;
    case 'yourHouse':
      update({ yourHouse: frame.yours });
      note('house', frame.yours === null ? 'no house yet' : `your house is ${frame.yours.house.name}`);
      return;
    case 'yourChoice':
      update({ yourChoice: frame.choice });
      note(
        'choice',
        frame.choice === null
          ? 'nothing to decide'
          : `"${frame.choice.prompt}", ${frame.choice.options.length} options`,
      );
      return;
    case 'yourKeyFigures':
      // Said before the state moves, because what is worth saying is the difference from what was held.
      for (const line of whatChanged(state.yourKeyFigures, frame.keyFigures, state.world?.today ?? null)) {
        note('characters', line);
      }
      update({ yourKeyFigures: frame.keyFigures });
      return;
    case 'yourSight': {
      const figures = new Map((state.yourKeyFigures ?? []).map((one) => [one.id, fullName(one)]));
      note(
        'sight',
        describeSight(frame.points, state.world?.today ?? null, (id) => figures.get(id)),
      );
      update({ yourSight: { points: frame.points, tension: frame.tension } });
      return;
    }
    case 'yourDialogues':
      // Said before the state moves, because what is worth saying is the difference from what was held.
      for (const line of whatChangedIn(state.yourDialogues, frame.dialogues)) {
        note('dialogues', line);
      }
      update({ yourDialogues: frame.dialogues });
      return;
    case 'worldWiped':
      // The world this window was looking at is gone. Arriving anew is the only honest thing to do, and
      // a reload is how a page arrives. See decision record 0036.
      note('world', `${frame.message}; arriving anew`);
      window.location.reload();
      return;
    case 'takenOver':
      // A player plays from one place. This window is finished; the socket goes with it. See 0028.
      forgetTheHold();
      update({
        connection: 'takenOver',
        houses: NO_HOUSES,
        yourHouse: null,
        yourChoice: null,
        yourKeyFigures: null,
        yourSight: null,
        yourDialogues: null,
      });
      note('gateway', `${frame.message}; this window is no longer playing`);
      connection?.close();
      return;
  }
}

/**
 * Counts one snapshot into the burst, and says what the burst brought once it stops arriving.
 *
 * A burst that brought nothing is not said at all: panning over empty world is not news, and a line a
 * cell buried everything else in the panel once the panel was the log. See decision record 0023.
 */
/**
 * Counts one tile of stands into the burst, and says what the burst brought once it stops arriving, as the
 * snapshots are said. A burst of tiles with no stands in them is not said: the gateway holding back what the
 * fog hides looks exactly like ground nothing grows on, which is the point. See decision record 0067.
 */
function gatherStands(frame: Extract<ServerFrame, { type: 'stands' }>): void {
  standing = alsoStood(standing, frame);
  if (gatheringStands !== null) {
    clearTimeout(gatheringStands);
  }
  gatheringStands = setTimeout(() => {
    gatheringStands = null;
    const said = describeStands(standing);
    standing = NO_STANDS_ARRIVED;
    if (said !== null) {
      note('stands', said);
    }
  }, GATHER_MS);
}

function gather(frame: Extract<ServerFrame, { type: 'snapshot' }>): void {
  arriving = alsoArrived(arriving, frame);
  if (gathering !== null) {
    clearTimeout(gathering);
  }
  gathering = setTimeout(() => {
    gathering = null;
    const said = describeArrival(arriving);
    arriving = NOTHING_ARRIVED;
    if (said !== null) {
      note('cells', said);
    }
  }, GATHER_MS);
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
 * Asks for the cells not yet followed, and lets go of the ones no longer wanted - but lets go late.
 *
 * The asking goes first and the forgetting waits. A zoom step wants a different cell for the same
 * ground, so letting the old one go first empties the map until the new one answers: every house is
 * dropped, every sprite is destroyed, and they come back a round trip later. That blink was the whole
 * of it. Now what is on the screen stays on the screen until what replaces it has arrived.
 *
 * The gateway is told to stop sending at once, because there is no reason for it to keep paying for
 * cells nobody is looking at. It is only this end that waits.
 */
function sendFollowing(cells: string[]): void {
  if (connection === null || state.connection !== 'open') {
    return;
  }
  // What is actually being followed. A released cell is still held - its houses are still drawn - but
  // the gateway has stopped answering for it, so wanting it again means asking for it again.
  const followed = cellsHeld(state.houses).filter((cell) => !released.has(cell));
  const { ask, letGo } = whatToFollow(followed, cells);

  // The gateway is told to stop sending **before** it is asked for more, because it holds at most
  // sixty-four cells and refuses a subscription that would take it past that - whole, not in part.
  // Asking first made it hold the old view and the new one at once, which at a wide zoom is ninety
  // cells for a view of forty-five, and every pan out there was refused. Only the *forgetting* was
  // ever meant to wait; the order on the wire is the one it always was.
  if (letGo.length > 0) {
    connection.send({ type: 'unsubscribeCells', cells: letGo });
    for (const cell of letGo) {
      released.add(cell);
    }
  }

  if (ask.length > 0) {
    for (const cell of ask) {
      released.delete(cell);
    }
    askedFor = ask;
    update({ houses: holdCells(state.houses, ask) });
    connection.send({ type: 'subscribeCells', cells: ask });
  }
  if (letGo.length > 0 || ask.length > 0) {
    followStands();
  }

  if (released.size === 0) {
    return;
  }
  if (ask.length > 0) {
    // Wait for what was just asked for. A later call replaces this rather than adding to it: both
    // batches are in flight at once, so the later one answers at about the same moment, and the
    // timer is underneath either way.
    awaiting = new Set(ask);
    if (holding !== null) {
      clearTimeout(holding);
    }
    holding = setTimeout(() => letGoNow('after waiting for what should have replaced them'), HOLD_MS);
  } else if (awaiting.size === 0) {
    // Nothing outstanding and nothing new asked for, so nothing is coming to replace them: a pan off
    // the edge of the world, or a view that shrank. Waiting would leave stale houses drawn.
    //
    // The `awaiting` test is what makes this safe to call twice. A map movement fires `moveend` and
    // `zoomend` both, so this runs twice for one step; the second time there is nothing left to ask
    // for, and without the test that second call would let go of everything a round trip early -
    // which is the very blink this exists to stop.
    letGoNow('with nothing asked for to replace them');
  }

  // Nothing is said about the asking. What the camera is following changes on every pan, and the answer
  // says the same thing better: the cells that came back, at what depth, and what was in them.
}

/**
 * Follows the camera: the cells covering the view, at the view's own zoom, are what the map draws. Safe to
 * call before the gateway has answered hello; the request waits for the welcome.
 */
export function follow(cells: string[]): void {
  wanted = cells;
  sendFollowing(cells);
}

/** Connects once, the first time anything asks. */
export function gateway(): Connection {
  if (connection !== null) return connection;

  const playerToken = ensurePlayerToken(
    { get: (key) => localStorage.getItem(key), set: (key, value) => localStorage.setItem(key, value) },
    () => crypto.randomUUID(),
  );
  update({ playerToken });
  note('gateway', `connecting to ${GATEWAY_URL}`);

  const socket = browserSocket(GATEWAY_URL);
  socket.onClose(() => {
    // A window that was taken over closed its own socket on purpose. Saying "the connection closed, is
    // the backend running?" over the top of that would be the panel telling a plain lie; see 0023.
    if (state.connection === 'takenOver') {
      return;
    }
    forgetTheHold();
    askedFrom.clear();
    stepsOut.clear();
    update({ connection: 'closed', houses: NO_HOUSES });
    note('gateway', 'the connection closed; is the backend running? cd backend then ./gradlew :app:bootRun');
  });
  // Not watching events: those are read on their own page, which watches without playing. See 0023.
  // The master the page draws, so the gateway sends that world's stands and no other. See 0067.
  connection = connect({ socket, playerToken, protocolVersion: PROTOCOL_VERSION, master: chosenMaster() });
  connection.onFrame(heard);
  connection.onProblem((problem) => note('gateway', problem));
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
  if (connection === null || state.connection !== 'open' || state.acting !== null) {
    return;
  }
  const commandId = crypto.randomUUID();
  update({ acting: commandId });
  askedFrom.set(commandId, 'command');
  note('command', `taking "${option.label}" as ${shortId(commandId)}`);
  connection.send({
    type: 'command',
    commandId,
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
function act(area: string, what: string, command: CommandPayload): void {
  if (connection === null || state.connection !== 'open') {
    return;
  }
  const commandId = crypto.randomUUID();
  askedFrom.set(commandId, area);
  note(area, `${what} as ${shortId(commandId)}`);
  connection.send({ type: 'command', commandId, command });
}

/*
 * Doing something to what your house has.
 *
 * Granting and spending are **Adam's levers** for now rather than a player's: nothing in the game gives a
 * house anything yet. They are here so that what the domain can do can be made to happen and watched.
 */

export function grantResource(resource: ResourceName, amount: number): void {
  act('resources', `granting ${amount} ${resource}`, { type: 'grantResource', resource, amount });
}

export function spendResource(resource: ResourceName, amount: number): void {
  act('resources', `spending ${amount} ${resource}`, { type: 'spendResource', resource, amount });
}

export function pledgeResource(
  resource: ResourceName,
  amount: number,
  months: number,
  purpose: string,
): void {
  act('resources', `pledging ${amount} ${resource} for ${months} ${months === 1 ? 'month' : 'months'}`, {
    type: 'pledgeResource',
    resource,
    amount,
    months,
    purpose,
  });
}

export function releasePledge(pledgeId: string): void {
  act('resources', `releasing pledge ${shortId(pledgeId)}`, { type: 'releasePledge', pledgeId });
}

/*
 * Doing something to your house's key figures.
 *
 * **Adam's levers**, like the resources': a house takes key figures in only from the debug panel, and
 * nothing in the game changes a stat or kills anyone yet. Every one that names a character is refused
 * `noSuchKeyFigure` unless the character is this house's own. See decision record 0055.
 */

export function addKeyFigure(): void {
  act('characters', 'taking a key figure in', { type: 'addKeyFigure' });
}

export function changeStat(figure: KeyFigureView, stat: StatName, by: number): void {
  const way = by > 0 ? 'raising' : 'lowering';
  act('characters', `${way} ${fullName(figure)}'s ${STAT_WORDS[stat].toLowerCase()} by ${Math.abs(by)}`, {
    type: 'changeStat',
    characterId: figure.id,
    stat,
    by,
  });
}

export function ageCharacter(figure: KeyFigureView, years: number): void {
  const said =
    years > 0
      ? `ageing ${fullName(figure)} by ${years} years`
      : `making ${fullName(figure)} ${-years} years younger`;
  act('characters', said, { type: 'ageCharacter', characterId: figure.id, years });
}

/** Gives somebody another portrait, or none, which is theirs from then on. */
export function changePortrait(figure: KeyFigureView, portrait: string | undefined): void {
  act(
    'characters',
    portrait === undefined
      ? `taking ${fullName(figure)}'s portrait away`
      : `giving ${fullName(figure)} another portrait, ${portrait}`,
    portrait === undefined
      ? { type: 'changePortrait', characterId: figure.id }
      : { type: 'changePortrait', characterId: figure.id, portrait },
  );
}

/** Puts one of the house's key figures somewhere on the map; how much they matter there is the world's. */
export function moveCharacter(figure: KeyFigureView, place: Point): void {
  act('characters', `putting ${fullName(figure)} at ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}`, {
    type: 'moveCharacter',
    characterId: figure.id,
    place,
  });
}

/*
 * Giving the house vision of a place outright, and taking it away. Adam's levers, in the Debug map section
 * under the fog switch; a storyline that gives a house sight of a far coast will send the same command. The
 * answers and the sight that follows are said in the same part of the log. See decision record 0061.
 */

export function giveVision(place: Point): void {
  act('sight', `giving your house vision at ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}`, {
    type: 'giveVision',
    place,
  });
}

export function takeVision(point: VisionPointView): void {
  if (point.kind !== 'given' || point.of === undefined) {
    return;
  }
  act('sight', `taking away the vision at ${point.place.lat.toFixed(3)}, ${point.place.lon.toFixed(3)}`, {
    type: 'takeVision',
    visionId: point.of,
  });
}

export function takeOffTheMap(figure: KeyFigureView): void {
  act('characters', `taking ${fullName(figure)} off the map`, {
    type: 'takeOffTheMap',
    characterId: figure.id,
  });
}

export function killCharacter(figure: KeyFigureView, cause: string): void {
  act('characters', `killing ${fullName(figure)}, ${cause}`, {
    type: 'killCharacter',
    characterId: figure.id,
    cause,
  });
}

/*
 * Offering the house a dialogue. Adam's lever, in the Dialogues section: nothing in the world offers one
 * yet. It names one of the server's samples and sends none of its words. See decision record 0071.
 */

export function offerDialogue(sample: string, described: string): void {
  act('dialogues', `offering ${described}`, { type: 'offerDialogue', sample });
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
  if (connection === null || state.connection !== 'open' || state.acting !== null) {
    return;
  }
  const commandId = crypto.randomUUID();
  // A new step is a new answer to wait for, so the last refusal is no longer the thing to say.
  update({ acting: commandId, stepRefused: null });
  askedFrom.set(commandId, 'dialogues');
  stepsOut.set(commandId, { dialogueId, lineId });
  note('dialogues', `taking ${described} as ${shortId(commandId)}`);
  connection.send({
    type: 'command',
    commandId,
    command: { type: 'completeDialogueStep', dialogueId, lineId },
  });
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
