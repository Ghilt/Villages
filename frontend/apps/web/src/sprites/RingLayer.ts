import { Sprite } from 'pixi.js';

import type { CameraView } from '../geometry/cameraMath';
import type { Layer } from './layer';
import type { MarksLayer } from './MarksLayer';
import { TEXTURE, type Textures } from './markTextures';

/**
 * What marks the selected house. The interface's own ink rather than its gold: the ground a house holds
 * is drawn in gold already, and a gold ring on a gold field is a ring nobody can see.
 */
const SELECTED = 0x241c14;

/**
 * The ring on the ground under the selected house or person, marking what it stands on rather than it: above
 * the fog and under every sprite. Drawn after the marks, because it is put where they were just drawn.
 */
export interface RingLayer extends Layer {
  readonly ring: Sprite;
  /** Marks one sprite as the selected one, or nothing when null. */
  setSelected(id: string | null): void;
}

export function createRingLayer(textures: Textures, marks: MarksLayer): RingLayer {
  // Under every sprite, because it marks the ground a house stands on rather than the house.
  const ring = new Sprite(textures.ring);
  ring.anchor.set(0.5, 0.5);
  ring.tint = SELECTED;
  ring.visible = false;
  let selected: string | null = null;

  return {
    ring,
    setSelected(id: string | null): void {
      selected = id;
    },
    draw(view: CameraView): number | null {
      const at = selected === null ? null : marks.standing(selected, view.zoom);
      if (at === null) {
        ring.visible = false;
        return null;
      }
      // Wider than the mark it is under, or it would be a ring nobody can see behind a castle.
      ring.visible = true;
      ring.scale.set((at.tall * 1.7) / TEXTURE.ringDiameter);
      ring.x = at.x;
      ring.y = at.y;
      return null;
    },
    // The canvas lets go of the ring with the rest of its stage.
    destroy(): void {},
  };
}
