import type { ComponentType } from 'react';

import { Foundations } from './Foundations';

/**
 * What the page shows, section by section, in the order it shows them.
 *
 * A component arrives on the page by being given a section here, or a part of one. A section that has not
 * arrived says which step of `docs/plans/ui-component-library.md` brings it, so an empty heading is a
 * promise with a date on it rather than a page that looks broken.
 */
export interface Section {
  /** The address of the section on the page: /admin/inspect-ui-components#borders. */
  readonly id: string;
  readonly title: string;
  /** What it shows, in a line. */
  readonly says: string;
  /** The step of the plan it arrives with, while it has not arrived. */
  readonly arrives?: number;
  readonly Body?: ComponentType;
}

export const SECTIONS: readonly Section[] = [
  {
    id: 'foundations',
    title: 'Foundations',
    says: 'The colours, the type and the spacing everything is drawn in.',
    Body: Foundations,
  },
  {
    id: 'pictures',
    title: 'Pictures',
    says: 'Every picture in world/ui/, at the sizes it is cut to, what it weighs, and whether it is still a placeholder.',
    arrives: 2,
  },
  {
    id: 'borders',
    title: 'Borders and fills',
    says: 'Nine-slice borders at any size, the fills inside them, and the seams at fractional scaling.',
    arrives: 3,
  },
  {
    id: 'containers',
    title: 'Containers',
    says: 'A border, a fill and its embellishments, named by a recipe, and a card inside a pane.',
    arrives: 4,
  },
  {
    id: 'buttons',
    title: 'Buttons',
    says: 'Text, mark and state buttons, and the window controls, in every state.',
    arrives: 5,
  },
  {
    id: 'readouts',
    title: 'Marks and readouts',
    says: 'Marks drawn and painted, the resource readout, the badge and the tooltip.',
    arrives: 6,
  },
  {
    id: 'controls',
    title: 'Controls',
    says: 'The slider, the meter, the stepper, the switch, a choice of a few, and hold to confirm.',
    arrives: 7,
  },
  {
    id: 'sections',
    title: 'Tabs and sections',
    says: 'The tab bar, the expandable section, the scroll area, the divider and the title plate.',
    arrives: 8,
  },
  {
    id: 'collections',
    title: 'Collections',
    says: 'The carousel and its dots, the grid, the card and the list.',
    arrives: 9,
  },
  {
    id: 'dialogs',
    title: 'Dialogs and fields',
    says: 'The dialog, the toast, the text field, the dropdown and the medallion.',
    arrives: 10,
  },
];
