import type { ClientFrame, CommandPayload } from '@villages/protocol';

/**
 * One way a command goes out and its answer comes back, as pure functions over what is in flight.
 *
 * Two lanes. The player's - taking an option of the choice put to the house, a step through a dialogue - goes one
 * command at a time, because a player answers one question and waits to be told how it went, and the panes press
 * nothing meanwhile. The levers' - the debug panel's, the event page's - go as fast as Adam pulls them. Each
 * command is filed under the part of the log it was asked from, and its answer is filed beside it.
 */
export type Lane = 'player' | 'lever';

export interface Outgoing {
  lane: Lane;
  /** The part of the log it is asked from, and its answer filed in. */
  area: string;
  /** What it does, in words, for the log's line: "taking ... as" its id. */
  what: string;
  command: CommandPayload;
}

export interface InFlight {
  /** The player's command waiting on its answer, or null: the one thing the panes wait on. */
  readonly acting: string | null;
  /** Where each command waiting on its answer was asked from, by its id. */
  readonly areas: ReadonlyMap<string, string>;
}

export const NOTHING_IN_FLIGHT: InFlight = { acting: null, areas: new Map() };

/** Whether the player may act now: the gateway listening, and nothing of the player's waiting on an answer. */
export function canAct(state: { connection: string; acting: string | null }): boolean {
  return state.connection === 'open' && state.acting === null;
}

/** A command going out: its frame, the log's line for it, and what is in flight after it. */
export interface Going {
  inFlight: InFlight;
  frame: ClientFrame;
  area: string;
  line: string;
}

/**
 * A command going out under `commandId`, or null when it may not: the gateway not listening, or, for a player's
 * command, the player's lane busy. The id becomes the causation of everything the command writes, so it is the
 * caller's to mint as a UUID. See decision record 0035.
 */
export function goingOut(inFlight: InFlight, open: boolean, commandId: string, out: Outgoing): Going | null {
  if (!open || (out.lane === 'player' && inFlight.acting !== null)) {
    return null;
  }
  return {
    inFlight: {
      acting: out.lane === 'player' ? commandId : inFlight.acting,
      areas: new Map(inFlight.areas).set(commandId, out.area),
    },
    frame: { type: 'command', commandId, command: out.command },
    area: out.area,
    line: `${out.what} as ${commandId.slice(0, 8)}`,
  };
}

/**
 * A command's answer: the part of the log its line goes in - where it was asked from, or the gateway's own for an
 * answer to nothing this page asked - and what is still in flight after it.
 */
export function answered(inFlight: InFlight, commandId: string): { inFlight: InFlight; area: string } {
  const areas = new Map(inFlight.areas);
  areas.delete(commandId);
  return {
    inFlight: { acting: inFlight.acting === commandId ? null : inFlight.acting, areas },
    area: inFlight.areas.get(commandId) ?? 'gateway',
  };
}
