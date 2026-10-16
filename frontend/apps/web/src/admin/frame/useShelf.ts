import { useEffect, useMemo, useRef, useState } from 'react';

import { connect } from '@villages/client-core';
import type { Connection } from '@villages/client-core';
import { PROTOCOL_VERSION } from '@villages/protocol';

import { GATEWAY_URL } from '../../net/address';
import { browserSocket } from '../../net/browserSocket';

/** What the game server answered a save: written, with the new fingerprint, or refused, and why. */
export type SaveAnswer =
  | { readonly saved: true; readonly fingerprint: string }
  | { readonly saved: false; readonly code: string; readonly reason: string };

/** An inspect page's link to the game server's catalogues: what it runs on, and saving through it. */
export interface ShelfLink {
  readonly state: 'connecting' | 'open' | 'closed';
  /** The fingerprint of each catalogue the game server runs on, by its name on the shelf; null until it says. */
  readonly inForce: Readonly<Record<string, string>> | null;
  /** Asks the game server to save [text] as [catalogue] and take it on, based on the file of [basedOn]. */
  revise(catalogue: string, text: string, basedOn: string): Promise<SaveAnswer>;
}

/**
 * The game server's catalogues, as an inspect page sees them: one connection that says no hello, told what the
 * server runs on as it opens and again whenever it takes something on, and through which a page saves a catalogue.
 * A page reads its catalogue from the dev server and needs nothing else to show it; saving needs this. See 0097.
 */
export function useShelf(): ShelfLink {
  const [state, setState] = useState<ShelfLink['state']>('connecting');
  const [inForce, setInForce] = useState<Readonly<Record<string, string>> | null>(null);
  const connection = useRef<Connection | null>(null);
  const waiting = useRef(new Map<string, (answer: SaveAnswer) => void>());

  useEffect(() => {
    // React mounts an effect twice in development: the first socket's close says nothing of the second.
    let live = true;
    const socket = browserSocket(GATEWAY_URL);
    socket.onOpen(() => live && setState('open'));
    socket.onClose(() => {
      if (!live) return;
      setState('closed');
      for (const [catalogue, answer] of waiting.current) {
        answer({
          saved: false,
          code: 'closed',
          reason: `the game server went before it answered for ${catalogue}`,
        });
      }
      waiting.current.clear();
    });
    const opened = connect({ socket, protocolVersion: PROTOCOL_VERSION, watchCatalogues: true });
    opened.onFrame((frame) => {
      if (!live) return;
      if (frame.type === 'cataloguesInForce') {
        setInForce(frame.fingerprints);
      } else if (frame.type === 'catalogueRevised' || frame.type === 'revisionRefused') {
        const answer = waiting.current.get(frame.catalogue);
        waiting.current.delete(frame.catalogue);
        answer?.(
          frame.type === 'catalogueRevised'
            ? { saved: true, fingerprint: frame.fingerprint }
            : { saved: false, code: frame.code, reason: frame.reason },
        );
      }
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
      inForce,
      revise: (catalogue: string, text: string, basedOn: string) =>
        new Promise<SaveAnswer>((answer) => {
          const open = connection.current;
          if (open === null || state !== 'open') {
            answer({
              saved: false,
              code: 'closed',
              reason: 'the game server is not running: start it to save',
            });
            return;
          }
          waiting.current.set(catalogue, answer);
          open.send({ type: 'reviseCatalogue', catalogue, text, basedOn });
        }),
    }),
    [state, inForce],
  );
}
