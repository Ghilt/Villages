import './fieldFigure.css';

import type { Pulled } from './FieldFigure';
import { pullSaid } from './figureWords';

/**
 * What a thing put on the line says over the picture it stands as - a building of the map's, which cannot say it
 * itself: its name under its foot, its ground lit while it is Empowered, and what it pulled rising over it as a
 * figure's does. A box as wide and tall as the picture it stands under, its foot its bottom middle; set it just
 * behind the picture, and its glow lies under it. See docs/UI-COMPONENTS.md.
 */
export function FieldTag({
  name,
  width,
  height,
  lit = false,
  pulled,
}: {
  name: string;
  /** How wide and tall the picture it tags is drawn, in the units it stands in. */
  width: number;
  height: number;
  lit?: boolean;
  pulled?: Pulled;
}) {
  return (
    <span className="ui-field-tag" style={{ width, height }}>
      <span className={`ui-field-figure__ground${lit ? ' ui-field-figure__ground--lit' : ''}`} />
      {pulled !== undefined && pulled.amount !== 0 && (
        <span key={pulled.key} className="ui-field-figure__pulled ui-field-tag__pulled ui-numeral">
          {pullSaid(pulled.amount)}
        </span>
      )}
      <span className="ui-field-figure__name">{name}</span>
    </span>
  );
}
