import { charactersInView, structuresInView } from '@villages/client-core';
import { PROTOCOL_VERSION, describeDay } from '@villages/protocol';
import type { ServerFrame } from '@villages/protocol';

import { whatChangedIn } from './dialogues/describe';
import { fullName, whatChanged } from './figures/describe';
import { describeSight } from './fog/describe';
import { note, shortId } from './log/log';
import {
  NOTHING_ARRIVED,
  NO_STANDS_ARRIVED,
  alsoArrived,
  alsoStood,
  describeArrival,
  describeBatch,
  describeStands,
} from './net/arrivals';
import type { Arrival, StandsArrival } from './net/arrivals';
import type { GatewayListener } from './net/gateway';
import { sayAnswer } from './inspect/waters';

/*
 * The session in the log: every line the page's conversation with the gateway says, written by listening to it
 * rather than from inside it, so that the conversation knows nothing of how its turns are put into words and the
 * words can use whatever the page has to say them with. The follower and the commands say their own lines, in
 * the client core. See decision record 0023.
 */

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
 * Counts one snapshot into the burst, and says what the burst brought once it stops arriving.
 *
 * A burst that brought nothing is not said at all: panning over empty world is not news, and a line a
 * cell buried everything else in the panel once the panel was the log. See decision record 0023.
 */
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

export const sessionLog: GatewayListener = {
  connecting: (url) => note('gateway', `connecting to ${url}`),

  // A window that was taken over closes its own socket on purpose, and is not told this: see the gateway.
  closed: () =>
    note('gateway', 'the connection closed; is the backend running? cd backend then ./gradlew :app:bootRun'),

  problem: (problem) => note('gateway', problem),

  heard: (frame, was, _now, answeredIn) => {
    switch (frame.type) {
      case 'welcome':
        note(
          'gateway',
          `welcome: player ${frame.playerId.slice(0, 8)}, server time ${new Date(frame.serverTime).toISOString()}`,
        );
        note(
          'world',
          `today is ${describeDay(frame.world.today)}; the earliest thing is from ${describeDay(frame.world.earliest)}`,
        );
        if (frame.keptIn) note('world', `kept ${frame.keptIn}`);
        return;
      case 'snapshot':
        gather(frame);
        return;
      case 'stands':
        gatherStands(frame);
        return;
      case 'batch': {
        // Who was standing where before the batch, so that somebody gone can be named in the line.
        const known = new Map(charactersInView(was.houses).map((one) => [one.id, one]));
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
        note('cells', `fell behind; asking again for ${frame.cells.length} cells`);
        return;
      case 'commandAccepted':
        note(answeredIn ?? 'gateway', `command ${shortId(frame.commandId)} accepted`);
        return;
      case 'commandRejected':
        note(answeredIn ?? 'gateway', `command ${shortId(frame.commandId)} rejected: ${frame.reason}`);
        return;
      case 'error':
        note('gateway', `error ${frame.code}: ${frame.message}`);
        return;
      case 'pong':
        note('gateway', `pong, round trip ${Date.now() - frame.t0} ms`);
        return;
      case 'yourHouse':
        note('house', frame.yours === null ? 'no house yet' : `your house is ${frame.yours.house.name}`);
        return;
      case 'yourChoice':
        note(
          'choice',
          frame.choice === null
            ? 'nothing to decide'
            : frame.choice.options[0]?.rarity === undefined
              ? `"${frame.choice.prompt}", ${frame.choice.options.length} options`
              : `a ${frame.choice.options[0].rarity} hand of ${frame.choice.options.length}, from ${frame.choice.omens?.length ?? 0} omens`,
        );
        return;
      case 'yourKeyFigures':
        // What is worth saying is the difference from what was held.
        for (const line of whatChanged(was.yourKeyFigures, frame.keyFigures, was.world?.today ?? null)) {
          note('characters', line);
        }
        return;
      case 'yourHoldings': {
        // Said when it differs from what was held: a holding gained or lost, the seat first.
        const names = frame.holdings.map((one) =>
          one.seatOf === undefined ? one.name : `${one.name} (seat)`,
        );
        const before = (was.yourHoldings ?? []).map((one) => `${one.id}@${one.stamp}`).join(' ');
        if (
          before !== frame.holdings.map((one) => `${one.id}@${one.stamp}`).join(' ') ||
          was.yourHoldings === null
        ) {
          note(
            'holdings',
            names.length === 0
              ? 'no holdings yet'
              : `${names.length} ${names.length === 1 ? 'holding' : 'holdings'}: ${names.join(', ')}`,
          );
        }
        return;
      }
      case 'yourSight': {
        // Key figures by their names, and a structure a vision is seen from by its own, where a cell has carried it.
        const named = new Map<string, string>([
          ...(was.yourKeyFigures ?? []).map((one): [string, string] => [one.id, fullName(one)]),
          ...structuresInView(was.houses).map((one): [string, string] => [one.id, one.name]),
        ]);
        note(
          'sight',
          describeSight(frame.points, was.world?.today ?? null, (id) => named.get(id)),
        );
        return;
      }
      case 'yourDialogues':
        // What is worth saying is the difference from what was held.
        for (const line of whatChangedIn(was.yourDialogues, frame.dialogues)) {
          note('dialogues', line);
        }
        return;
      case 'worldWiped':
        note('world', `${frame.message}; arriving anew`);
        return;
      case 'takenOver':
        note('gateway', `${frame.message}; this window is no longer playing`);
        return;
      case 'event': // A player's window never asks for stored events; they have a page of their own (0023).
        return;
      case 'inspectedAt':
        // What water a click pointed at, as the server named it, or why it named none. See 0087.
        note('inspect', sayAnswer(frame));
        return;
      case 'rollDrawn':
        note(
          'roll',
          `drew ${frame.rarity}${frame.forced ? ", the lever's" : ''} from ${frame.opened.join(', ')}: ` +
            `${frame.considered.length} could have been dealt`,
        );
        return;
      case 'inspected': {
        // What a window asking after its subject was told: a name, or nothing at all. See 0088.
        const someone = frame.character;
        const told = frame.house?.name ?? (someone ? `${someone.givenName} ${someone.familyName}` : null);
        note(
          'inspect',
          `the gateway answered the ${frame.kind} asked after: ${told ?? 'nothing, none such or under the fog'}`,
        );
        return;
      }
    }
    return frame satisfies never; // Every frame has a case above, so a new one does not compile until it has.
  },

  done: (frame) => {
    if (frame.type === 'error' && frame.code === 'protocolVersion') {
      // The one error whose cause is never in the code: a server left running from an older build.
      // Saying what to do here saves reading the message and guessing. See decision record 0037.
      note(
        'gateway',
        `this page speaks version ${PROTOCOL_VERSION}, so the server on the other end is a different ` +
          'build of the program. Stop it and start it again from this tree with debug-quick-start.ps1 -Stop.',
      );
    }
  },
};
