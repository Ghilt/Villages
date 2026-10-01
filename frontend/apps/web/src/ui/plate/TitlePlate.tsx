import './plate.css';

import type { ReactNode } from 'react';

import { Container } from '../container/Container';
import type { RecipeName } from '../container/recipes';
import { amountSaid } from '../readout/readout';

/**
 * A title plate: the cartouche a place's name and its figure sit on, as the moodboard's Paris has it, and
 * a pane's name at a smaller size. A container like any other, named by a recipe, and as wide as its words
 * rather than as whatever holds it, because a plate is a label and not a sheet. See docs/UI-COMPONENTS.md.
 */
export function TitlePlate({
  title,
  figure,
  says,
  emblem,
  recipe = 'plate.place',
}: {
  title: ReactNode;
  /** The number it is known by, a place's people, in figures that do not jitter as they change. */
  figure?: number | string;
  /** What the figure is, or anything said after it: Prosperity. */
  says?: ReactNode;
  /** A mark or a small picture before the words: the place's emblem. */
  emblem?: ReactNode;
  recipe?: RecipeName;
}) {
  return (
    <Container recipe={recipe} className="ui-plate">
      <span className="ui-plate__inner">
        {emblem !== undefined && <span className="ui-plate__emblem">{emblem}</span>}
        <span className="ui-plate__words">
          <span className="ui-plate__title">{title}</span>
          {(figure !== undefined || says !== undefined) && (
            <span className="ui-plate__detail">
              {figure !== undefined && <span className="ui-numeral">{amountSaid(figure)}</span>}
              {figure !== undefined && says !== undefined && (
                <span className="ui-plate__dot" aria-hidden>
                  ·
                </span>
              )}
              {says !== undefined && <em className="ui-plate__says">{says}</em>}
            </span>
          )}
        </span>
      </span>
    </Container>
  );
}
