import { useEffect, useMemo, useRef, useState } from 'react';

import { connect } from '@villages/client-core';
import type { Connection } from '@villages/client-core';
import { PROTOCOL_VERSION } from '@villages/protocol';
import type { ChallengeSimulatedFrame, SimulateChallengeFrame } from '@villages/protocol';

import { GATEWAY_URL } from '../../net/address';
import { browserSocket } from '../../net/browserSocket';

/** A challenge as the page asks for one: each side's slices, the progression, and a seed or none. */
export type Asked = Omit<SimulateChallengeFrame, 'type' | 'id'>;

/** What the game server answered: the challenge fought, or refused, and why. */
export type Answer =
  | { readonly fought: true; readonly challenge: ChallengeSimulatedFrame }
  | { readonly fought: false; readonly code: string; readonly reason: string };

export interface Simulator {
  readonly state: 'connecting' | 'open' | 'closed';
  /** Has the game server fight [asked] out. */
  simulate(asked: Asked): Promise<Answer>;
}

/**
 * The challenges' page's link to the game server's engine: one connection that says no hello, through which the page
 * has a challenge fought out and is answered with every moment of it, each answer matched to its asking by an id of
 * the page's own. An instrument, which a server with its instruments closed refuses. See decision record 0105.
 */
export function useSimulator(): Simulator {
  const [state, setState] = useState<Simulator['state']>('connecting');
  const connection = useRef<Connection | null>(null);
  const waiting = useRef(new Map<string, (answer: Answer) => void>());
  const asked = useRef(0);

  useEffect(() => {
    // React mounts an effect twice in development: the first socket's close says nothing of the second.
    let live = true;
    const socket = browserSocket(GATEWAY_URL);
    socket.onOpen(() => live && setState('open'));
    socket.onClose(() => {
      if (!live) return;
      setState('closed');
      for (const answer of waiting.current.values()) {
        answer({ fought: false, code: 'closed', reason: 'the game server went before it answered' });
      }
      waiting.current.clear();
    });
    const opened = connect({ socket, protocolVersion: PROTOCOL_VERSION });
    opened.onFrame((frame) => {
      if (!live || (frame.type !== 'challengeSimulated' && frame.type !== 'simulationRefused')) return;
      const answer = waiting.current.get(frame.id);
      waiting.current.delete(frame.id);
      answer?.(
        frame.type === 'challengeSimulated'
          ? { fought: true, challenge: frame }
          : { fought: false, code: frame.code, reason: frame.reason },
      );
    });
    connection.current = opened;
    return () => {
      live = false;
      opened.close();
    };
  }, []);

  return useMemo(
    () => ({
      state,
      simulate: (wanted: Asked) =>
        new Promise<Answer>((answer) => {
          const open = connection.current;
          if (open === null || state !== 'open') {
            answer({
              fought: false,
              code: 'closed',
              reason: 'the game server is not running: start it to fight',
            });
            return;
          }
          asked.current += 1;
          const id = `run-${asked.current}`;
          waiting.current.set(id, answer);
          open.send({ type: 'simulateChallenge', id, ...wanted });
        }),
    }),
    [state],
  );
}
