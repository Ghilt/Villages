import './crowdCard.css';

import { useEffect, useRef, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { createPortal } from 'react-dom';

import { markKey } from '@villages/world';
import type { StructureAtlasFile } from '@villages/world';

import { PinGroup, SheetPicture } from '../ui/pinGroup/PinGroup';
import type { PinGroupMember } from '../ui/pinGroup/PinGroup';
import type { MapSprite } from './SpriteRenderer';

/*
 * A crowd of marks far out, opened: the card of every mark its leader stood for, over the place it was opened at. It
 * shuts on Escape, on a press anywhere else, and when the camera moves, because the crowd it was opened on is
 * another crowd, or none, once the camera has moved. See `markGroups.ts` and decision record 0096.
 */

/** Where `world:structures` puts the atlas the pins are cut into, as `structureAtlas.ts` reads it for the map. */
const ATLAS = '/art/structures';
/** How tall a pin is drawn in the card. */
const PIN_HEIGHT = 40;

let sheet: Promise<StructureAtlasFile | null> | null = null;
/** The atlas's table of pictures, read once for every card. */
function readSheet(): Promise<StructureAtlasFile | null> {
  sheet ??= fetch(`${ATLAS}.json`)
    .then((answer) => (answer.ok ? (answer.json() as Promise<StructureAtlasFile>) : null))
    .catch(() => null);
  return sheet;
}

/** A person's bust in their house's colours, as the map draws them far out. */
function Bust({ tint }: { tint: number }) {
  const fill = `#${tint.toString(16).padStart(6, '0')}`;
  return (
    <svg width="30" height="32" viewBox="0 0 60 64" aria-hidden="true">
      <path d="M3 61 C3 40 14 33 30 33 C46 33 57 40 57 61 Z" fill={fill} stroke="#4a4034" strokeWidth="5" />
      <circle cx="30" cy="18" r="13" fill={fill} stroke="#4a4034" strokeWidth="5" />
    </svg>
  );
}

function memberOf(sprite: MapSprite, atlas: StructureAtlasFile | null): PinGroupMember {
  const type = sprite.structure?.picture.split('@')[0] ?? '';
  const frame = atlas?.frames[markKey(type)];
  const picture =
    sprite.kind === 'character' ? (
      <Bust tint={sprite.tint} />
    ) : atlas !== null && frame !== undefined ? (
      <SheetPicture
        src={`${ATLAS}.webp?v=${atlas.version}`}
        sheet={atlas}
        frame={frame}
        height={PIN_HEIGHT}
      />
    ) : null;
  return { id: sprite.id, name: sprite.name ?? type, picture };
}

export function CrowdCard({
  map,
  members,
  at,
  onPick,
  onClose,
}: {
  map: maplibregl.Map;
  /** The crowd, its leader first and the rest in rank order. */
  members: readonly MapSprite[];
  /** Where on the map's canvas it was opened, which the card stands over. */
  at: { x: number; y: number };
  onPick: (sprite: MapSprite, how: { closer: boolean }) => void;
  onClose: () => void;
}) {
  const [atlas, setAtlas] = useState<StructureAtlasFile | null>(null);
  const card = useRef<HTMLDivElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    void readSheet().then(setAtlas);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close.current();
    const onPress = (event: PointerEvent) => {
      if (card.current !== null && !card.current.contains(event.target as Node)) close.current();
    };
    const onMove = () => close.current();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPress, true);
    map.on('movestart', onMove);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPress, true);
      map.off('movestart', onMove);
    };
  }, [map]);

  const byId = new Map(members.map((one) => [one.id, one]));
  return createPortal(
    <div ref={card} className="crowd-card ui-root" style={{ left: `${at.x}px`, top: `${at.y}px` }}>
      <PinGroup
        members={members.map((one) => memberOf(one, atlas))}
        label={`${members.length} marks standing here`}
        onPick={(id, how) => {
          const picked = byId.get(id);
          if (picked !== undefined) onPick(picked, how);
        }}
      />
    </div>,
    map.getContainer(),
  );
}
