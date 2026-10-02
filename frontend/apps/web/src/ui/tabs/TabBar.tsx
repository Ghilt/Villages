import './tabs.css';

import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { usePictures } from '../art/pictures';
import { FaceLayer } from '../button/Button';
import type { Showing } from '../button/Button';
import { faceOf } from '../button/face';
import { Container } from '../container/Container';
import type { RecipeName } from '../container/recipes';
import { Mark } from '../mark/Mark';
import type { MarkName } from '../mark/Mark';
import { ScrollArea } from '../scroll/ScrollArea';
import { Tooltip } from '../tooltip/Tooltip';
import { stepTo, TAB_HEIGHTS } from './tabs';
import type { TabSize } from './tabs';

/**
 * The tab bar: several things taking turns in one place, and a row of tabs saying which is up. A tab is
 * a mark or words, as a button is, and which is Adam's call each time: the game's own bar is marks, for
 * a column too narrow for two words.
 *
 * Each tab is drawn on a face, dark wood at rest and the parchment of the pane it opens when it is the one
 * chosen. The arrow keys go along the tabs and choose as they go, Home and End go to the ends, and a row
 * too long for its room scrolls across rather than wrapping. `Tabbed` tucks a bar under the top of the
 * pane it chooses for, so the two are one piece of furniture. See docs/UI-COMPONENTS.md.
 */

export interface Tab {
  readonly id: string;
  /** What it is, in words: written on it, or its tooltip and what a screen reader says, when it is a mark. */
  readonly label: string;
  /** A mark on it instead of the words. */
  readonly mark?: MarkName;
  readonly disabled?: boolean;
  /** Draw it as if hovered, pressed or focused: for the page, never for the game. */
  readonly showing?: Showing;
}

/** The face a tab is drawn on, at rest and chosen. */
const FACES = { rest: 'tab', chosen: 'tab-chosen' } as const;

export function TabBar({
  tabs,
  chosen,
  onChoose,
  label,
  size = 'regular',
  end,
  ids,
}: {
  tabs: readonly Tab[];
  /** The id of the tab that is up. */
  chosen: string;
  onChoose: (id: string) => void;
  /** What the tabs choose between, for a screen reader: What is in this corner. */
  label: string;
  size?: TabSize;
  /** What stands at the far end of the bar rather than among the tabs: the tile's size control. */
  end?: ReactNode;
  /** The ids its tabs and the panel they choose for go by, which `Tabbed` gives it. */
  ids?: { readonly tab: (id: string) => string; readonly panel: string };
}) {
  const list = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])];
    const on = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const from = on >= 0 ? on : tabs.findIndex((tab) => tab.id === chosen);
    const to = stepTo(
      from,
      event.key,
      tabs.map((tab) => tab.disabled !== true),
    );
    if (to === null) {
      return;
    }
    event.preventDefault();
    onChoose(tabs[to]!.id);
    buttons[to]?.focus();
    buttons[to]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  return (
    <div className={`ui-tabs ui-tabs--${size}`}>
      <ScrollArea axis="across" focusable={false} className="ui-tabs__scroll">
        <div ref={list} className="ui-tabs__list" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              chosen={tab.id === chosen}
              size={size}
              onChoose={onChoose}
              {...(ids === undefined ? {} : { id: ids.tab(tab.id), panel: ids.panel })}
            />
          ))}
        </div>
      </ScrollArea>
      {end !== undefined && <div className="ui-tabs__end">{end}</div>}
    </div>
  );
}

function TabButton({
  tab,
  chosen,
  size,
  onChoose,
  id,
  panel,
}: {
  tab: Tab;
  chosen: boolean;
  size: TabSize;
  onChoose: (id: string) => void;
  id?: string;
  panel?: string;
}) {
  const { list } = usePictures();
  const height = TAB_HEIGHTS[size];
  const face = chosen ? FACES.chosen : FACES.rest;
  const ends = faceOf(list, face, height)?.ends ?? [height / 3, height / 3];
  const button = (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={chosen}
      aria-controls={panel}
      tabIndex={chosen ? 0 : -1}
      className={`ui-button ui-tab ui-tab--${size}${tab.mark === undefined ? '' : ' ui-tab--mark'}`}
      style={
        tab.mark === undefined
          ? { height, paddingLeft: ends[0], paddingRight: ends[1] }
          : { height, width: Math.round(height * 1.2) }
      }
      disabled={tab.disabled === true}
      data-showing={tab.showing}
      onClick={() => onChoose(tab.id)}
      {...(tab.mark === undefined ? {} : { 'aria-label': tab.label })}
    >
      <FaceLayer name={face} height={height} />
      {tab.mark === undefined ? (
        <span className="ui-button__label">{tab.label}</span>
      ) : (
        <span className="ui-button__mark">
          <Mark name={tab.mark} size={Math.round(height * 0.56)} />
        </span>
      )}
    </button>
  );
  return tab.mark === undefined ? (
    button
  ) : (
    <Tooltip text={tab.label} describes={false}>
      {button}
    </Tooltip>
  );
}

/**
 * A tab bar and the pane it chooses for, as one piece: the bar tucked under the top of the pane's border,
 * the pane showing whatever the chosen tab holds. The pane is a container like any other, named by a
 * recipe, and the tile is one size whichever tab is up, so choosing one never resizes anything.
 */
export function Tabbed({
  tabs,
  chosen,
  onChoose,
  label,
  recipe = 'pane.plain',
  size,
  end,
  children,
}: {
  tabs: readonly Tab[];
  chosen: string;
  onChoose: (id: string) => void;
  label: string;
  recipe?: RecipeName;
  size?: TabSize;
  end?: ReactNode;
  /** What the chosen tab holds. */
  children: ReactNode;
}) {
  const base = useId();
  const ids = { tab: (id: string) => `${base}tab-${id}`, panel: `${base}panel` };
  return (
    <div className="ui-tabbed">
      <TabBar
        tabs={tabs}
        chosen={chosen}
        onChoose={onChoose}
        label={label}
        ids={ids}
        {...(size === undefined ? {} : { size })}
        {...(end === undefined ? {} : { end })}
      />
      <Container recipe={recipe} className="ui-tabbed__pane">
        <div
          className="ui-tabbed__panel"
          role="tabpanel"
          id={ids.panel}
          aria-labelledby={ids.tab(chosen)}
          tabIndex={0}
        >
          {children}
        </div>
      </Container>
    </div>
  );
}
