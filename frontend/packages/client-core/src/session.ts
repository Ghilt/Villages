import type { ChoiceView, CommandPayload, OptionView, Point, ServerFrame } from '@villages/protocol';

import { NOTHING_IN_FLIGHT, answered, goingOut } from './commands';
import type { InFlight, Outgoing } from './commands';
import { connect } from './connection';
import type { Connection, SocketLike } from './connection';
import { follower } from './follower';
import type { Schedule } from './follower';
import { INITIAL_SESSION, endState, foldFrame } from './slices';
import type { EndCause, FrameOf, FrameType, SessionState } from './slices';
import { createStore } from './store';

/**
 * What listens to the conversation without taking part in it: a log. It is told when the session connects and
 * when the connection closes, and of a problem with a frame; and of every frame once the state has taken it in,
 * with the state as it was before, but before whatever the frame makes the session do, and again once that is
 * done. A command's answer comes with the part of the log its asking was filed in.
 */
export interface SessionListener {
  connecting?(address: string): void;
  closed?(): void;
  problem?(problem: string): void;
  heard?(frame: ServerFrame, was: SessionState, now: SessionState, answeredIn: string | null): void;
  done?(frame: ServerFrame): void;
}

/** What the session needs from wherever it runs. */
export interface SessionPorts {
  schedule: Schedule;
  /** A fresh UUID, for a command's id. See decision record 0035. */
  newId(): string;
  /** The scenery's stands for a tile, as far as the fog lets them through, and which cells are followed. See 0067. */
  standsArrived(x: number, y: number, stands: string): void;
  followStands(cells: string[]): void;
  /** Arrives anew, for a world that has been emptied: a reload, in a browser. See decision record 0036. */
  arriveAnew(): void;
  /** What the follower and the commands say, as `note(area, message)`. */
  note(area: string, message: string): void;
}

export interface ConnectOptions {
  socket: SocketLike;
  playerToken: string;
  protocolVersion: number;
  /** The master the page draws, said in hello so the gateway sends that world's stands. See 0067. */
  master?: string;
  /** Where it connects, for saying so. */
  address: string;
}

export interface Session {
  state(): SessionState;
  watch(listener: () => void): () => void;
  observe(listener: SessionListener): () => void;
  /** Opens the conversation, as a player, once. */
  connect(options: ConnectOptions): Connection;
  /** Follows the camera: see the follower. Safe before the welcome; the request waits for it. */
  follow(cells: string[]): void;
  /**
   * Sets significance aside on this connection, or takes it back: see everything, which is not the player's eye.
   * Held in the state, and safe before the welcome, which says it again. See 0038.
   */
  seeAll(on: boolean): void;
  /** Lets the fog fall on this connection, or lifts it. Held in the state, and said again at the welcome. See 0061. */
  fogOfWar(on: boolean): void;
  /** Empties the development world, for everyone connected to it. See 0036. */
  wipeWorld(): void;
  /** Saves the development world under a name, beside every tree; answered by `savesListed`. See 0101. */
  saveWorld(name: string): void;
  /** Asks which saves there are, into `saves`. Nothing is asked while the connection is not open. See 0101. */
  listSaves(): void;
  /**
   * Gives the world one of the saves, for everybody connected to it. Every session is ended when it is in, as by a
   * wipe, so the answer is arriving anew. See 0101.
   */
  loadSave(name: string): void;
  /**
   * Asks what water is at a place on the map, which a click that hit nothing else does: the answer comes back as
   * `inspectedAt`, kept in the state. Nothing is asked while the connection is not open. See 0087.
   */
  inspectAt(at: Point): void;
  /** Takes one option of the choice the player has: a player's command. See 0035 on its story. */
  takeOption(choice: ChoiceView, option: OptionView): void;
  /** Take action: rolls for a hand, saying what the page is looking at. A player's command. See 0083. */
  roll(looking: Looking): void;
  /** Sends one of Adam's levers as a real command, said in the part of the log it belongs to. */
  pull(area: string, what: string, command: CommandPayload): void;
  /** Takes a step through one of the house's dialogues, from its pane: a player's command. See 0071. */
  completeDialogueStep(dialogueId: string, lineId: string, described: string): void;
  /** Meets an objective of the node a quest stands at, by the player's press: a player's command. See 0096. */
  meetObjective(questId: string, nodeId: string, objectiveId: string, described: string): void;
  /** Collects the reward a quest stands at: a player's command. See 0096. */
  collectReward(questId: string, nodeId: string, described: string): void;
  /**
   * Asks after a window's subject wherever the camera is: answered once into `inspected`. Asked once a connection,
   * because nothing is sent again, and not at all before the welcome. See decision record 0088.
   */
  inspect(kind: 'house' | 'character' | 'structure', id: string): void;
}

/** What the page says it is looking at as it rolls: the `roll` command without its type. Every field a claim. */
export type Looking = Omit<Extract<CommandPayload, { type: 'roll' }>, 'type'>;

/**
 * The page's side of the conversation with the gateway: its state, folded from what each mechanic folds; the
 * cells the camera follows; the commands; and the two switches, see everything and the fog. It sends through the
 * connection it opens, waits on the clock it is handed, and says nothing itself but the follower's and the
 * commands' own lines: whatever listens is told the rest. See decision record 0078.
 */
export function createSession(ports: SessionPorts): Session {
  const store = createStore<SessionState>(INITIAL_SESSION);
  const listening = new Set<SessionListener>();
  let connection: Connection | null = null;
  /** The commands waiting on their answers, and where each was asked from. See `goingOut`. */
  let inFlight: InFlight = NOTHING_IN_FLIGHT;

  const open = () => connection !== null && store.get().connection === 'open';
  /** The subjects asked after on this connection, by `kind:id`: a new connection asks again. */
  const askedAfter = new Set<string>();

  const following = follower({
    send: (frame) => connection?.send(frame),
    canSend: open,
    onTheMap: () => store.get().onTheMap,
    setOnTheMap: (onTheMap) => store.set({ onTheMap }),
    followStands: ports.followStands,
    note: ports.note,
    schedule: ports.schedule,
  });

  /** Ends the session's hold on the world, as each part ends. A window taken over closes its own socket after. */
  const end = (cause: EndCause) => {
    following.forget();
    if (cause === 'closed') {
      // No answer to anything in flight is coming now, so nothing is filed for one.
      inFlight = { ...inFlight, areas: new Map() };
    }
    store.set(endState(store.get(), cause));
  };

  /**
   * Sends a command the one way commands go, minting its id, and says so in the part of the log it was asked from.
   * A player's command waits for the one before it to be answered; a lever does not. The id, or null.
   */
  const issue = (
    out: Outgoing,
    alsoNow: (commandId: string) => Partial<SessionState> = () => ({}),
  ): string | null => {
    const commandId = ports.newId();
    const going = goingOut(inFlight, open(), commandId, out);
    if (going === null || connection === null) {
      return null;
    }
    inFlight = going.inFlight;
    if (out.lane === 'player') {
      store.set({ acting: commandId, ...alsoNow(commandId) });
    }
    ports.note(going.area, going.line);
    connection.send(going.frame);
    return commandId;
  };

  /** What each kind of frame makes the session do, once its parts have folded it: every kind named. */
  const ROUTES: { [T in FrameType]: (frame: FrameOf<T>) => void } = {
    welcome: () => {
      // The two switches first, because they decide what a snapshot carries and the cells are asked for next.
      const { seeAll, fogOfWar } = store.get();
      if (seeAll) connection?.send({ type: 'seeAll', on: true });
      if (!fogOfWar) connection?.send({ type: 'fogOfWar', on: false });
      askedAfter.clear();
      // Anything the camera wanted before the gateway was listening is asked for now.
      following.welcomed();
    },
    snapshot: (frame) => following.answered(frame.cell),
    // What the scenery grows from, as far as the fog lets it through. See decision record 0067.
    stands: (frame) => ports.standsArrived(frame.x, frame.y, frame.stands),
    batch: () => undefined,
    // The gateway let these go. Asking again is what gets fresh snapshots.
    resync: (frame) => connection?.send({ type: 'subscribeCells', cells: frame.cells }),
    commandAccepted: () => undefined,
    commandRejected: () => undefined,
    error: (frame) => {
      if (frame.code === 'tooManyCells' || frame.code === 'badCell') {
        // The whole subscription was refused. Put the connection back the way it was, or the map goes
        // blank and stays blank however far it is panned. See the follower's `refused`.
        following.refused(`the gateway refused ${frame.code}`);
      }
    },
    pong: () => undefined,
    yourHouse: () => undefined,
    yourChoice: () => undefined,
    yourKeyFigures: () => undefined,
    yourHoldings: () => undefined,
    yourSight: () => undefined,
    yourDialogues: () => undefined,
    yourQuests: () => undefined,
    // The world this window was looking at is gone. Arriving anew is the only honest thing to do. See 0036.
    worldWiped: () => ports.arriveAnew(),
    // A player plays from one place. This window is finished; the socket goes with it. See 0028.
    takenOver: () => connection?.close(),
    // A player's window never asks for stored events; they have a page of their own. See 0023.
    event: () => undefined,
    rollDrawn: () => undefined,
    inspected: () => undefined,
    // What water the page pointed at, kept in the state for the page to open a window from. See 0087.
    inspectedAt: () => undefined,
    // A player's window never reads or saves a catalogue; the inspect pages do, with no session. See 0097.
    cataloguesInForce: () => undefined,
    catalogueRevised: () => undefined,
    revisionRefused: () => undefined,
    // What saves there are: the panel's to say and show. See 0101.
    savesListed: () => undefined,
  };

  /** Takes a frame in: the parts fold it, the listeners are told, then what the frame makes the session do. */
  const heard = (frame: ServerFrame) => {
    const was = store.get();
    let answeredIn: string | null = null;
    if (frame.type === 'commandAccepted' || frame.type === 'commandRejected') {
      const answer = answered(inFlight, frame.commandId);
      inFlight = answer.inFlight;
      answeredIn = answer.area;
    }
    if (frame.type === 'takenOver') {
      end('takenOver');
    } else {
      store.set(foldFrame(was, frame));
    }
    for (const listener of listening) listener.heard?.(frame, was, store.get(), answeredIn);
    (ROUTES[frame.type] as (frame: ServerFrame) => void)(frame);
    for (const listener of listening) listener.done?.(frame);
  };

  return {
    state: store.get,
    watch: store.watch,
    observe: (listener) => {
      listening.add(listener);
      return () => {
        listening.delete(listener);
      };
    },

    connect: (options) => {
      if (connection !== null) return connection;
      store.set({ playerToken: options.playerToken });
      for (const listener of listening) listener.connecting?.(options.address);
      connection = connect({
        socket: options.socket,
        playerToken: options.playerToken,
        protocolVersion: options.protocolVersion,
        ...(options.master === undefined ? {} : { master: options.master }),
      });
      connection.onClose(() => {
        // A window that was taken over closed its own socket on purpose. Saying "the connection closed, is
        // the backend running?" over the top of that would be the panel telling a plain lie; see 0023.
        if (store.get().connection === 'takenOver') {
          return;
        }
        end('closed');
        for (const listener of listening) listener.closed?.();
      });
      connection.onFrame(heard);
      connection.onProblem((problem) => {
        for (const listener of listening) listener.problem?.(problem);
      });
      return connection;
    },

    follow: (cells) => following.follow(cells),

    seeAll: (on) => {
      if (open()) connection?.send({ type: 'seeAll', on });
      store.set({ seeAll: on });
    },

    fogOfWar: (on) => {
      if (open()) connection?.send({ type: 'fogOfWar', on });
      store.set({ fogOfWar: on });
    },

    inspectAt: (at) => {
      if (open()) connection?.send({ type: 'inspectAt', at });
    },

    inspect: (kind, id) => {
      if (!open() || askedAfter.has(`${kind}:${id}`)) return;
      askedAfter.add(`${kind}:${id}`);
      connection?.send({ type: 'inspect', kind, id });
    },

    wipeWorld: () => {
      if (!open()) return;
      ports.note('world', 'emptying the world');
      connection?.send({ type: 'wipeWorld' });
    },

    saveWorld: (name) => {
      if (!open()) return;
      ports.note('world', `saving the world as ${name}`);
      connection?.send({ type: 'saveWorld', name });
    },

    listSaves: () => {
      if (open()) connection?.send({ type: 'listSaves' });
    },

    loadSave: (name) => {
      if (!open()) return;
      ports.note('world', `loading the save ${name}`);
      connection?.send({ type: 'loadSave', name });
    },

    roll: (looking) => {
      issue({ lane: 'player', area: 'roll', what: 'taking action', command: { type: 'roll', ...looking } });
    },

    takeOption: (choice, option) => {
      issue({
        lane: 'player',
        area: 'command',
        what: `taking "${option.label}"`,
        command: { type: 'takeAction', choiceId: choice.id, optionId: option.id },
      });
    },

    pull: (area, what, command) => {
      issue({ lane: 'lever', area, what, command });
    },

    completeDialogueStep: (dialogueId, lineId, described) => {
      // A new step is a new answer to wait for, so the last refusal is no longer the thing to say.
      issue(
        {
          lane: 'player',
          area: 'dialogues',
          what: `taking ${described}`,
          command: { type: 'completeDialogueStep', dialogueId, lineId },
        },
        (commandId) => ({ stepRefused: null, stepping: { commandId, dialogueId, lineId } }),
      );
    },
    meetObjective: (questId, nodeId, objectiveId, described) => {
      issue({
        lane: 'player',
        area: 'quests',
        what: described,
        command: { type: 'meetObjective', questId, nodeId, objectiveId },
      });
    },
    collectReward: (questId, nodeId, described) => {
      issue({
        lane: 'player',
        area: 'quests',
        what: described,
        command: { type: 'collectReward', questId, nodeId },
      });
    },
  };
}
