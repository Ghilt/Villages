import { Container, Graphics, Text } from 'pixi.js';

/*
 * The badge on a mark that leads a crowd far out: "+9", how many more it stands for, on a small gold plate at the top
 * right of its picture. A click on it opens the crowd. See `markGroups.ts`.
 */

const PLATE = 0xb08a4a;
const EDGE = 0xf4ece0;
const INK = 0x2b2320;
const HEIGHT = 15;
const FONT = "'EB Garamond Variable', 'Palatino Linotype', Palatino, Georgia, serif";

export interface Badge {
  readonly view: Container;
  /** Says how many more, and puts the badge at the top right of a picture standing at `at`, `wide` by `tall`. */
  show(more: number, at: { x: number; y: number }, wide: number, tall: number, alpha: number): void;
  hide(): void;
  destroy(): void;
}

export function createBadge(): Badge {
  const view = new Container();
  const plate = new Graphics();
  const label = new Text({
    text: '',
    style: { fontFamily: FONT, fontSize: 13, fontWeight: '600', fill: INK },
  });
  label.anchor.set(0.5, 0.5);
  view.addChild(plate, label);
  view.visible = false;
  let said = -1;

  return {
    view,
    show(more, at, wide, tall, alpha) {
      if (more !== said) {
        said = more;
        label.text = `+${more}`;
        const width = Math.max(HEIGHT, label.width + 8);
        plate
          .clear()
          .roundRect(-width / 2, -HEIGHT / 2, width, HEIGHT, HEIGHT / 2)
          .fill(PLATE)
          .stroke({ width: 1.5, color: EDGE });
      }
      view.visible = alpha > 0;
      view.alpha = alpha;
      view.position.set(at.x + wide * 0.4, at.y - tall * 0.92);
    },
    hide() {
      view.visible = false;
    },
    destroy() {
      view.destroy({ children: true });
    },
  };
}
