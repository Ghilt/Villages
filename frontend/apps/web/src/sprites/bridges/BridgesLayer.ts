import { Sprite } from 'pixi.js';

import { BRIDGE_SPAN, bridgeKey } from '@villages/world';

import { pixelsPerWorldUnit, standingLayer, tiltGround } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { note } from '../../log/log';
import { heldStandsOf, onStandsArrived, onStandsFollowed } from '../../net/stands';
import { piecesHeld } from '../ground/roads';
import type { Layer } from '../layer';
import type { SettlementPictures } from '../settlements/settlementPictures';
import type { StandingLayer, StandingThing } from '../standing/StandingLayer';
import { BECOMES_A_MARK_AT } from '../twoForms';
import { bridgesAmong, deckOf } from './bridges';
import type { Bridge } from './bridges';

/*
 * The bridges, drawn: every bridge among the roads the game server sent, its picture by the way it runs from the
 * settlements' atlas, hung at the middle of its deck and scaled to its span, standing among the trees on the strip of
 * its deck as a structure stands on its footprint (0110). Where its road is worn into the ground it is drawn, from zoom
 * 7.5 in, fading in as the worked ground does; further out, and until the pictures are read, nothing. See
 * docs/plans/settlements-and-roads.md and decision record 0115.
 */

export interface BridgesLayer extends Layer {
  /** How many bridges the page holds, and how many are drawn now. */
  report(): { bridges: number; drawn: number };
}

const smoothstep = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

export function createBridgesLayer(pictures: SettlementPictures, standing: StandingLayer): BridgesLayer {
  let stale = true;
  const stopArriving = onStandsArrived((_, __, layer) => {
    if (layer === 'roads') stale = true;
  });
  const stopFollowing = onStandsFollowed(() => {
    stale = true;
  });
  const held = new Map<string, { bridge: Bridge; sprite: Sprite | null }>();
  let said = -1;
  let drawn = 0;

  /** The bridges held again, a sprite each kept while its bridge is, made once its picture is read. */
  function gather(): void {
    const now = bridgesAmong(
      piecesHeld(
        [...heldStandsOf('roads')].flatMap((tile) => (tile.roads === undefined ? [] : [tile.roads])),
      ),
    );
    const ids = new Set(now.map((bridge) => bridge.id));
    for (const [id, one] of held) {
      if (ids.has(id)) continue;
      one.sprite?.destroy();
      held.delete(id);
    }
    for (const bridge of now) {
      if (!held.has(bridge.id)) held.set(bridge.id, { bridge, sprite: null });
    }
    if (held.size !== said) {
      said = held.size;
      note('roads', `${held.size} ${held.size === 1 ? 'bridge' : 'bridges'} held, standing among the trees`);
    }
  }

  return {
    draw(view: CameraView): number | null {
      if (stale) {
        gather();
        stale = false;
      }
      const fade = smoothstep(BECOMES_A_MARK_AT, BECOMES_A_MARK_AT + 0.5, view.zoom);
      const { scale, x: left, y: top, tilt } = standingLayer(view);
      const things: StandingThing[] = [];
      drawn = 0;
      for (const one of held.values()) {
        const picture = pictures.of(bridgeKey(one.bridge.axis));
        if (picture === null) continue;
        if (one.sprite === null || one.sprite.texture !== picture.texture) {
          one.sprite?.destroy();
          one.sprite = new Sprite(picture.texture);
        }
        const { sprite, bridge } = one;
        // The picture is of a bridge `BRIDGE_SPAN` long: this one is drawn as long as it is.
        const stretch = bridge.span / BRIDGE_SPAN;
        const foot = tiltGround(bridge.middle.x, bridge.middle.y, tilt);
        sprite.anchor.set(picture.foot.x, picture.foot.y);
        sprite.scale.set((picture.tall * stretch * pixelsPerWorldUnit(view.zoom)) / sprite.texture.height);
        sprite.position.set(foot.x * scale + left, foot.y * scale + top);
        sprite.alpha = fade;
        const onScreen =
          sprite.x > -sprite.width && sprite.x < view.width + sprite.width && sprite.y > -sprite.height;
        sprite.visible = fade > 0 && onScreen && sprite.y < view.height + sprite.height;
        if (sprite.visible) drawn += 1;
        const tall = picture.tall * stretch;
        things.push({
          id: bridge.id,
          sprites: [sprite],
          place: bridge.middle,
          anchor: picture.foot.x,
          footprint: deckOf(bridge),
          tall: tall * picture.foot.y,
          wide: (tall * sprite.texture.width) / sprite.texture.height,
          shown: sprite.visible,
        });
      }
      standing.stand(things, 'bridges');
      return null;
    },

    report: () => ({ bridges: held.size, drawn }),

    destroy(): void {
      stopArriving();
      stopFollowing();
      for (const one of held.values()) one.sprite?.destroy();
      held.clear();
    },
  };
}
