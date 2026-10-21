import { Container, Geometry, GlProgram, Mesh, Shader, UniformGroup } from 'pixi.js';

import type { CameraView } from '../geometry/cameraMath';
import { shadersStore } from '../shaders/levels';
import type { Layer } from './layer';
import type { MarksLayer } from './MarksLayer';
import { RING_FRAGMENT, RING_REACH, RING_VERTEX } from './ringShader';
import { PRESENCE_MS, easeTowards, midTrade } from './twoForms';

/** Twenty-four frames a second while a ring is moving: a slow breath and a slow wave need no more. */
const MOVING_MS = 42;

/**
 * The ring on the ground under the selected house or person, marking what it stands on rather than it. Close in it lies
 * on the ground round its footprint, under the trees and whatever stands among them, in the world under the fog, which
 * is clear over it in vision; far out it rings its sign, and is a sign itself, over the fog and the clouds with it. A
 * light that breathes, drawn by its own shader on a square the size of it (`ringShader.ts`), still for anyone who has
 * asked for less motion and while the Shaders switch is off. Drawn after the marks, because it is put where they were
 * just drawn. See decision record 0110.
 */
export interface RingLayer extends Layer {
  /** Where it lies on the ground, between the trees' shadows and the trees. */
  readonly onTheGround: Container;
  /** Where it rings a sign, over the fog and the clouds and under the marks. */
  readonly withTheSigns: Container;
  /** Marks one sprite as the selected one, or nothing when null. */
  setSelected(id: string | null): void;
}

export function createRingLayer(marks: MarksLayer, repaint: () => void): RingLayer {
  const uniforms = new UniformGroup({
    uRadius: { value: 1, type: 'f32' },
    uReach: { value: RING_REACH, type: 'f32' },
    uTime: { value: 0, type: 'f32' },
    uMoving: { value: 1, type: 'f32' },
  });
  const shader = new Shader({
    glProgram: GlProgram.from({ vertex: RING_VERTEX, fragment: RING_FRAGMENT, name: 'selection-ring' }),
    resources: { ringUniforms: uniforms },
  });
  const mesh = new Mesh({
    geometry: new Geometry({
      attributes: { aPosition: [-1, -1, 1, -1, 1, 1, -1, 1] },
      indexBuffer: [0, 1, 2, 0, 2, 3],
    }),
    shader,
  });
  mesh.visible = false;
  const onTheGround = new Container();
  const withTheSigns = new Container();
  onTheGround.addChild(mesh);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stopWatching = shadersStore.watch(repaint);
  let selected: string | null = null;
  /** How far in the ring has faded, nought to one, so it comes up on what was picked rather than appearing. */
  let presence = 0;

  return {
    onTheGround,
    withTheSigns,
    setSelected(id: string | null): void {
      if (id !== selected) {
        presence = 0;
      }
      selected = id;
    },
    draw(view: CameraView, _now: number, elapsed: number): number | null {
      const at = selected === null ? null : marks.ringUnder(selected, view);
      if (at === null) {
        mesh.visible = false;
        return null;
      }
      presence = easeTowards(presence, 1, elapsed, PRESENCE_MS);
      const moving = !still && shadersStore.get().on;
      const lies = at.onTheGround ? onTheGround : withTheSigns;
      if (mesh.parent !== lies) {
        lies.addChild(mesh);
      }
      mesh.visible = true;
      mesh.alpha = presence;
      mesh.position.set(at.x, at.y);
      mesh.scale.set(at.across * RING_REACH, at.across * at.lean * RING_REACH);
      const u = uniforms.uniforms;
      u.uRadius = at.across;
      // By the wall clock, as the trees' wind is, so the ring breathes the same in every window that shows it.
      u.uTime = moving ? (Date.now() % 3_600_000) / 1000 : 0;
      u.uMoving = moving ? 1 : 0;
      uniforms.update();
      return moving ? MOVING_MS : midTrade(presence) ? 0 : null;
    },
    destroy(): void {
      stopWatching();
      mesh.destroy();
      shader.destroy();
      onTheGround.destroy();
      withTheSigns.destroy();
    },
  };
}
