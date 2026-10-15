import { useEffect, useMemo, useRef, useState } from 'react';

import { canAct, freeNow, questLayout } from '@villages/client-core';
import type { QuestNodeView, QuestView, ResourceName } from '@villages/protocol';

import { DIALOGUE_PANE } from '../dialogues/pane';
import { Scene } from '../dialogues/Scene';
import { openConversation } from '../dialogues/toOpen';
import { RESOURCE_WORDS } from '../house/describe';
import { collectReward, meetObjective, sessionStore } from '../net/gateway';
import { arrive } from '../stage/arrive';
import { Icon } from '../stage/Icons';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import type { Room } from '../stage/panes';
import { useStore } from '../store/useStore';
import { MarkButton } from '../ui/button/Button';
import { Container } from '../ui/container/Container';
import { Mark } from '../ui/mark/Mark';
import type { MarkName } from '../ui/mark/Mark';
import { ChecklistRow } from '../ui/quest/ChecklistRow';
import { QuestMap } from '../ui/quest/QuestMap';
import type { MapNode } from '../ui/quest/QuestMap';
import { howMany, type ListedQuest, listOf, objectiveWords } from './describe';
import { questOpened, questToOpenStore } from './toOpen';

/**
 * **Quests**: the quests the house has been offered, and the one whose map is open.
 *
 * It stands from the house's first quest on and is never closed after that, because the finished ones are kept. In
 * the spread it takes turns with the dialogues in the column down the right edge, and on a phone it is a pane like
 * any other. See `MECHANICS.md` and decision record 0096.
 *
 * Two states, as the dialogues have: **the list**, the quests open and under them the ones finished and lost; and
 * **a quest**, opened by pressing one, its map over its scene with the way back to the list in its head. Which is
 * open is the pane's own state, and outlives its sizes because a pane is never unmounted. Put away it is its name
 * and how many there are.
 */
export function Quests({ room }: { room: Room }) {
  const quests = useStore(sessionStore, (state) => state.yourQuests);
  const list = useMemo(() => listOf(quests ?? []), [quests]);
  const [open, setOpen] = useState<string | null>(null);
  // A quest that has gone - a wipe - leaves the list behind it rather than nothing.
  const quest = quests?.find((one) => one.id === open) ?? null;

  // A quest arriving asks to be opened, so the map is what the player meets, whether the pane stood already or was
  // made in the same moment; once opened, the asking is done.
  const asked = useStore(questToOpenStore, (state) => state.id);
  useEffect(() => {
    if (asked !== null && quests?.some((one) => one.id === asked)) {
      setOpen(asked);
      questOpened();
    }
  }, [asked, quests]);

  if (room.size === 'strip') {
    return (
      <section className="quests quests--strip pane-strip" aria-label="Quests">
        <span className="quests__name">Quests</span>
        <span className="quests__count">{howMany(quests ?? [])}</span>
        <PaneSizeControl room={room} />
      </section>
    );
  }

  if (quest !== null) {
    return <QuestOpen quest={quest} room={room} onBack={() => setOpen(null)} />;
  }

  return (
    <section className={`quests quests--${room.size}`} aria-label="Quests">
      <header className="quests__head">
        <h2 className="quests__name">Quests</h2>
        <PaneSizeControl room={room} />
      </header>
      <div className="quests__list">
        <h3 className="quests__group">Open</h3>
        {list.open.length === 0 ? (
          <p className="quests__none">No quest is open.</p>
        ) : (
          <Rows quests={list.open} onOpen={setOpen} />
        )}
        {list.finished.length > 0 && (
          <>
            <h3 className="quests__group">Finished</h3>
            <Rows quests={list.finished} onOpen={setOpen} />
          </>
        )}
      </div>
    </section>
  );
}

/** The list's rows: pressing one opens its map. */
function Rows({ quests, onOpen }: { quests: readonly ListedQuest[]; onOpen: (id: string) => void }) {
  return (
    <ol className="quests__rows">
      {quests.map((one) => (
        <li key={one.id} className={one.lost ? 'quests__row quests__row--lost' : 'quests__row'}>
          <button type="button" className="quests__open" onClick={() => onOpen(one.id)}>
            <span className="quests__title">{one.title}</span>
            <span className="quests__line">{one.line}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** The widest a map is drawn, however wide the pane: a road read from the top down, not a chart across a page. */
const WIDEST_MAP = 440;

/** A quest open: its map over its scene, read from the top down, and the way back to the list. */
function QuestOpen({ quest, room, onBack }: { quest: QuestView; room: Room; onBack: () => void }) {
  const placed = useMemo(() => questLayout(quest), [quest]);
  const nodes: MapNode[] = quest.nodes.map((node) => ({
    id: node.id,
    ...placed.get(node.id)!,
    ...(node.kind === undefined ? {} : { kind: node.kind }),
    state: node.state,
    ...(node.title === undefined ? {} : { title: node.title }),
  }));
  const area = useRef<HTMLDivElement | null>(null);
  const width = useWidth(area);
  // The node whose card is open, by id. A dialogue node opens its conversation instead, on the dialogues' tab.
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const card = quest.nodes.find((node) => node.id === chosen);
  const press = (id: string) => {
    const node = quest.nodes.find((one) => one.id === id);
    if (node?.kind === 'dialogue' && node.dialogueId !== undefined && node.state !== 'lost') {
      openConversation(node.dialogueId);
      arrive(DIALOGUE_PANE.id, { inTheSpread: 'small' });
      return;
    }
    setChosen((was) => (was === id ? undefined : id));
  };

  return (
    <section className={`quests quests--${room.size} quests--open`} aria-label={quest.title}>
      {/* Where the story is happening, behind the whole of it, as a conversation is drawn over its scene. */}
      {quest.scene !== undefined && <Scene scene={quest.scene} />}
      <header className="quests__head">
        <button
          type="button"
          className="quests__back"
          aria-label="all quests"
          title="all quests"
          onClick={onBack}
        >
          <Icon name="list" />
        </button>
        <h2 className="quests__name">{quest.title}</h2>
        <PaneSizeControl room={room} />
      </header>
      <div className="quests__map" ref={area}>
        {width > 0 && (
          <QuestMap
            nodes={nodes}
            edges={quest.edges}
            width={Math.min(width, WIDEST_MAP)}
            label={quest.title}
            onPress={press}
            {...(chosen === undefined ? {} : { chosen })}
          />
        )}
        {card !== undefined && <NodeCard quest={quest} node={card} />}
      </div>
    </section>
  );
}

/**
 * What a node holds, under the map once it is pressed: its checklist, each row with the mark that meets it while the
 * quest stands there and the player is the one who meets it, greyed with what the house has free while it cannot pay;
 * or what a reward gives, and *Collect* while the quest stands at it. A question mark is not yet known, and a node lost
 * says so. The marks are Adam's word of 2026-10-15.
 */
function NodeCard({ quest, node }: { quest: QuestView; node: QuestNodeView }) {
  const resources = useStore(sessionStore, (state) => state.yourHouse?.resources ?? null);
  const acting = !useStore(sessionStore, canAct);
  const here = node.state === 'current';
  const free = (resource: ResourceName): number =>
    resources === null ? 0 : Math.floor(freeNow(resources[resource], Date.now()));
  return (
    <div className="quests__card">
      <Container recipe="card.figure">
        <h3 className="quests__card-title">{node.title ?? 'Not yet known'}</h3>
        {node.state === 'lost' && (
          <p className="quests__card-line">Lost: the road taken does not lead here.</p>
        )}
        {node.kind === undefined && node.state !== 'lost' && (
          <p className="quests__card-line">What waits here is shown when the quest reaches it.</p>
        )}
        {(node.objectives ?? []).map((objective) => {
          const words = objectiveWords(objective);
          const lead = objective.kind === 'hold' ? 'tower' : MARK_OF[objective.resource];
          if (objective.kind === 'hold') {
            return (
              <ChecklistRow
                key={objective.id}
                words={words}
                lead={<Mark name={lead} size={17} />}
                met={objective.met}
                {...(objective.met ? {} : { note: 'Ticked when your house holds one.' })}
              />
            );
          }
          const short = free(objective.resource) < objective.amount;
          const what = RESOURCE_WORDS[objective.resource].toLowerCase();
          return (
            <ChecklistRow
              key={objective.id}
              words={words}
              lead={<Mark name={lead} size={17} />}
              met={objective.met}
              {...(here && !objective.met
                ? {
                    action: {
                      mark: objective.kind,
                      label: words,
                      disabled: short || acting,
                      onPress: () =>
                        meetObjective(
                          quest.id,
                          node.id,
                          objective.id,
                          `meeting "${words}" in "${quest.title}"`,
                        ),
                    },
                  }
                : {})}
              {...(here && !objective.met && short
                ? { note: `Your house has ${free(objective.resource)} ${what} free.` }
                : {})}
            />
          );
        })}
        {node.kind === 'reward' && (
          <div className="quests__gifts">
            {(node.gives ?? []).map((gift, at) =>
              gift.kind === 'grant' ? (
                <span key={at} className="quests__gift">
                  <Mark name={MARK_OF[gift.resource]} size={17} />+{gift.amount}
                </span>
              ) : null,
            )}
            {here && (
              <MarkButton
                label={`Collect ${node.title ?? 'the reward'}`}
                mark="collect"
                disabled={acting}
                onClick={() =>
                  collectReward(
                    quest.id,
                    node.id,
                    `collecting "${node.title ?? 'the reward'}" in "${quest.title}"`,
                  )
                }
              />
            )}
          </div>
        )}
      </Container>
    </div>
  );
}

/** A resource's mark in the library, by its wire name: the library calls Domain `domain`. */
const MARK_OF: Record<ResourceName, MarkName> = {
  wealth: 'wealth',
  naturalDomain: 'domain',
  influence: 'influence',
  reason: 'reason',
  piety: 'piety',
};

/** How wide an element is, kept current as its pane is resized. */
function useWidth(element: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const it = element.current;
    if (it === null) {
      return undefined;
    }
    const measure = () => setWidth(Math.floor(it.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(it);
    return () => observer.disconnect();
  }, [element]);
  return width;
}
