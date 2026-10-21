import { useEffect, useMemo, useRef, useState } from 'react';

import { connect } from '@villages/client-core';
import type { Connection } from '@villages/client-core';
import { PROTOCOL_VERSION } from '@villages/protocol';
import type {
  ChallengeSimulatedFrame,
  MatchupsSimulatedFrame,
  SimulateChallengeFrame,
  SimulationRefusedFrame,
} from '@villages/protocol';

import { GATEWAY_URL } from '../../net/address';
import { browserSocket } from '../../net/browserSocket';

/** A challenge as the page asks for one: each side's slices, the progression, and a seed or none. */
export type Asked = Omit<SimulateChallengeFrame, 'type' | 'id'>;

/** What the game server answered: the challenge fought, or refused, and why. */
export type Answer =
  | { readonly fought: true; readonly challenge: ChallengeSimulatedFrame }
  | { readonly fought: false; readonly code: string; readonly reason: string };

/** What the game server answered a grid of matchups: every aspect weighed against every other, or refused, and why. */
export type Weighed =
  | { readonly weighed: true; readonly grid: MatchupsSimulatedFrame }
  | { readonly weighed: false; readonly code: string; readonly reason: string };

export interface Simulator {
  readonly state: 'connecting' | 'open' | 'closed';
  /** Has the game server fight [asked] out. */
  simulate(asked: Asked): Promise<Answer>;
  /** Has the game server weigh every aspect against every other, [runs] a pairing, on the challenge kind [kind]. */
  weigh(kind: string, runs: number): Promise<Weighed>;
}

/** An answer as it arrives, or none when the game server went before it answered. */
type Answered = ChallengeSimulatedFrame | MatchupsSimulatedFrame | SimulationRefusedFrame | null;

const GONE = 'the game server went before it answered';

/**
 * The challenges' page's link to the game server's engine: one connection that says no hello, through which the page
 * has a challenge fought out, or every aspect weighed against every other, each answer matched to its asking by an id
 * of the page's own. An instrument, which a server with its instruments closed refuses. See decision record 0107.
 */
export function useSimulator(): Simulator {
  const [state, setState] = useState<Simulator['state']>('connecting');
  const connection = useRef<Connection | null>(null);
  const waiting = useRef(new Map<string, (answered: Answered) => void>());
  const asked = useRef(0);

  useEffect(() => {
    // React mounts an effect twice in development: the first socket's close says nothing of the second.
    let live = true;
    const socket = browserSocket(GATEWAY_URL);
    socket.onOpen(() => live && setState('open'));
    socket.onClose(() => {
      if (!live) return;
      setState('closed');
      for (const answer of waiting.current.values()) answer(null);
      waiting.current.clear();
    });
    const opened = connect({ socket, protocolVersion: PROTOCOL_VERSION });
    opened.onFrame((frame) => {
      if (!live) return;
      if (
        frame.type !== 'challengeSimulated' &&
        frame.type !== 'simulationRefused' &&
        frame.type !== 'matchupsSimulated'
      ) {
        return;
      }
      const answer = waiting.current.get(frame.id);
      waiting.current.delete(frame.id);
      answer?.(frame);
    });
    connection.current = opened;
    return () => {
      live = false;
      opened.close();
    };
  }, []);

  return useMemo(() => {
    /** Sends a frame under a fresh id, and hands what answers it to [answered]; false when there is no server to ask. */
    const ask = (
      prefix: string,
      send: (id: string) => void,
      answered: (frame: Answered) => void,
    ): boolean => {
      const open = connection.current;
      if (open === null || state !== 'open') return false;
      asked.current += 1;
      const id = `${prefix}-${asked.current}`;
      waiting.current.set(id, answered);
      send(id);
      return true;
    };
    return {
      state,
      simulate: (wanted: Asked) =>
        new Promise<Answer>((answer) => {
          const sent = ask(
            'run',
            (id) => connection.current?.send({ type: 'simulateChallenge', id, ...wanted }),
            (frame) => {
              if (frame === null) answer({ fought: false, code: 'closed', reason: GONE });
              else if (frame.type === 'challengeSimulated') answer({ fought: true, challenge: frame });
              else if (frame.type === 'simulationRefused')
                answer({ fought: false, code: frame.code, reason: frame.reason });
            },
          );
          if (!sent)
            answer({
              fought: false,
              code: 'closed',
              reason: 'the game server is not running: start it to fight',
            });
        }),
      weigh: (kind: string, runs: number) =>
        new Promise<Weighed>((answer) => {
          const sent = ask(
            'grid',
            (id) => connection.current?.send({ type: 'simulateMatchups', id, kind, runs }),
            (frame) => {
              if (frame === null) answer({ weighed: false, code: 'closed', reason: GONE });
              else if (frame.type === 'matchupsSimulated') answer({ weighed: true, grid: frame });
              else if (frame.type === 'simulationRefused')
                answer({ weighed: false, code: frame.code, reason: frame.reason });
            },
          );
          if (!sent)
            answer({
              weighed: false,
              code: 'closed',
              reason: 'the game server is not running: start it to weigh',
            });
        }),
    };
  }, [state]);
}
