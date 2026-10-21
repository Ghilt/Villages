import type { ComponentType } from 'react';

import { Bars } from './Bars';
import { BordersAndFills } from './BordersAndFills';
import { Buttons } from './Buttons';
import { Challenges } from './Challenges';
import { Collections } from './Collections';
import { Containers } from './Containers';
import { Controls } from './Controls';
import { DialogsAndFields } from './DialogsAndFields';
import { Foundations } from './Foundations';
import { LoadingScreens } from './LoadingScreens';
import { MarksAndReadouts } from './MarksAndReadouts';
import { Pictures } from './Pictures';
import { Quests } from './Quests';
import { Rolls } from './Rolls';
import { SigningIn } from './SigningIn';
import { Slots } from './Slots';
import { TabsAndSections } from './TabsAndSections';

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
    says: 'Every picture in world/ui/ as it is cut, what it weighs, and whether it is still a placeholder.',
    Body: Pictures,
  },
  {
    id: 'borders',
    title: 'Borders and fills',
    says: 'Nine-slice borders at any size, the fills inside them, and the seams at fractional scaling.',
    Body: BordersAndFills,
  },
  {
    id: 'containers',
    title: 'Containers',
    says: 'A border, a fill and its embellishments, named by a recipe, and a card inside a pane.',
    Body: Containers,
  },
  {
    id: 'buttons',
    title: 'Buttons',
    says: 'Text, mark and state buttons, and the window controls, in every state.',
    Body: Buttons,
  },
  {
    id: 'readouts',
    title: 'Marks and readouts',
    says: 'Marks drawn and painted, the resource readout, the badge and the tooltip.',
    Body: MarksAndReadouts,
  },
  {
    id: 'controls',
    title: 'Controls',
    says: 'The slider, the meter, the stepper, the switch, a choice of a few, and hold to confirm.',
    Body: Controls,
  },
  {
    id: 'roll',
    title: 'The choice roll',
    says: 'The report card the omens slam into, the rarity stamped across it, and the strip it folds to.',
    Body: Rolls,
  },
  {
    id: 'quests',
    title: 'Quests',
    says: "A quest's node in every kind and state, the map that lays them out, and the checklist a node opens to.",
    Body: Quests,
  },
  {
    id: 'sections',
    title: 'Tabs and sections',
    says: 'The tab bar, the expandable section, the scroll area, the divider and the title plate.',
    Body: TabsAndSections,
  },
  {
    id: 'bars',
    title: 'Bars',
    says: 'The bottom bar a phone chooses its panes with, and the top bar of a window on top of one.',
    Body: Bars,
  },
  {
    id: 'collections',
    title: 'Collections',
    says: 'The card, the grid, the carousel and its dots, the list, and a crowd of marks opened.',
    Body: Collections,
  },
  {
    id: 'slots',
    title: 'Slots',
    says: "A structure's slots: the socket for each place in one, and the slot's row of them.",
    Body: Slots,
  },
  {
    id: 'dialogs',
    title: 'Dialogs and fields',
    says: 'The dialog, the toast, the text field, the dropdown and the medallion.',
    Body: DialogsAndFields,
  },
  {
    id: 'signing-in',
    title: 'Signing in',
    says: "The email and password fields, the form they stand in, and Google's and Discord's buttons.",
    Body: SigningIn,
  },
  {
    id: 'challenges',
    title: 'Challenges',
    says: 'What a challenge is watched with: a slice’s chip, a house’s tray, a slice opened, the tug, the happening, the replay and a figure on the field.',
    Body: Challenges,
  },
  {
    id: 'loading',
    title: 'The loading screen',
    says: 'What covers the game while it is made ready, held, filling and fading.',
    Body: LoadingScreens,
  },
];
