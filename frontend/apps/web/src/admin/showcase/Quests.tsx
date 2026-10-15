import { useState } from 'react';

import { MarkButton } from '../../ui/button/Button';
import { Container } from '../../ui/container/Container';
import { Mark } from '../../ui/mark/Mark';
import { ChecklistRow } from '../../ui/quest/ChecklistRow';
import { QuestMap } from '../../ui/quest/QuestMap';
import type { MapEdge, MapNode } from '../../ui/quest/QuestMap';
import { QuestNode } from '../../ui/quest/QuestNode';
import type { QuestNodeKind, QuestNodeState } from '../../ui/quest/QuestNode';
import { Part, Specimen, Specimens } from './Specimen';

const KINDS: readonly (QuestNodeKind | undefined)[] = ['dialogue', 'checklist', 'reward', undefined];
const STATES: readonly QuestNodeState[] = ['current', 'ahead', 'done', 'lost'];

/** The abbot of the isle at its start: the abbot lit, two question marks one edge ahead, one shown half-way down. */
const AT_THE_START: readonly MapNode[] = [
  {
    id: 'gate',
    row: 0,
    column: 0,
    columns: 1,
    kind: 'dialogue',
    state: 'current',
    title: 'The abbot at the gate',
  },
  { id: 'gift', row: 1, column: 0, columns: 2, state: 'ahead' },
  { id: 'light', row: 1, column: 1, columns: 2, state: 'ahead' },
  { id: 'consecration', row: 2, column: 0, columns: 1, state: 'ahead' },
  {
    id: 'blessing',
    row: 3,
    column: 0,
    columns: 1,
    kind: 'reward',
    state: 'ahead',
    title: "The abbot's blessing",
  },
];
const ROADS: readonly MapEdge[] = [
  { from: 'gate', to: 'gift', state: 'ahead' },
  { from: 'gate', to: 'light', state: 'ahead' },
  { from: 'gift', to: 'consecration', state: 'ahead' },
  { from: 'light', to: 'consecration', state: 'ahead' },
  { from: 'consecration', to: 'blessing', state: 'ahead' },
];

/** Answered badly: the cheap road lost and shown for what it was, the castle's road where it stands. */
const ON_THE_BAD_ROAD: readonly MapNode[] = [
  { ...AT_THE_START[0]!, state: 'done' },
  { ...AT_THE_START[1]!, kind: 'checklist', state: 'lost', title: 'A gift to the mission' },
  { ...AT_THE_START[2]!, kind: 'checklist', state: 'current', title: 'A light on the water' },
  AT_THE_START[3]!,
  AT_THE_START[4]!,
];
const WALKED: readonly MapEdge[] = [
  { from: 'gate', to: 'gift', state: 'lost' },
  { from: 'gate', to: 'light', state: 'walked' },
  { from: 'gift', to: 'consecration', state: 'lost' },
  { from: 'light', to: 'consecration', state: 'ahead' },
  { from: 'consecration', to: 'blessing', state: 'ahead' },
];

/** A quest with a node not drawn: edges into and out of it are stubs, and the blessing stands as far down as it is. */
const WITH_STUBS: readonly MapNode[] = [
  { id: 'letter', row: 0, column: 0, columns: 1, kind: 'dialogue', state: 'current', title: 'A letter' },
  { id: 'road', row: 1, column: 0, columns: 1, state: 'ahead' },
  { id: 'end', row: 3, column: 0, columns: 1, kind: 'reward', state: 'ahead', title: 'What it gives' },
];
const STUBS: readonly MapEdge[] = [
  { from: 'letter', to: 'road', state: 'ahead' },
  { from: 'road', state: 'ahead' },
  { to: 'end', state: 'ahead' },
];

/**
 * A quest's parts: the node in every kind and state, the map that lays nodes out and draws the edges between them,
 * and the checklist row a node opens to. Every mark is a drawn placeholder; a picture in `world/ui/marks/` by the
 * mark's name is drawn instead once it is painted. See decision record 0096.
 */
export function Quests() {
  const [open, setOpen] = useState<string | undefined>('light');
  const [paid, setPaid] = useState(false);
  /** The rows once, shown on night and on the parchment of the card the game draws them on. */
  const checklist = (
    <>
      <ChecklistRow
        words="Deliver 60"
        lead={<Mark name="wealth" size={17} />}
        met={paid}
        action={{ mark: 'deliver', label: 'Deliver 60 wealth', onPress: () => setPaid(true) }}
      />
      <ChecklistRow
        words="Pledge 30 for 6 months"
        lead={<Mark name="piety" size={17} />}
        met={false}
        action={{
          mark: 'pledge',
          label: 'Pledge 30 piety for 6 months',
          onPress: () => undefined,
          disabled: true,
        }}
        note="Your house has 12 piety free."
      />
      <ChecklistRow
        words="Hold a castle on an island"
        lead={<Mark name="tower" size={17} />}
        met={false}
        note="Ticked when your house holds one."
      />
      <ChecklistRow words="Hold a castle on an island" lead={<Mark name="tower" size={17} />} met />
    </>
  );

  return (
    <>
      <Part title="The node">
        <Specimens>
          {KINDS.map((kind) => (
            <Specimen
              key={kind ?? 'unknown'}
              name={`QuestNode ${kind ?? '(a question mark)'}`}
              note="current, ahead, done, lost"
            >
              <div className="showcase__try">
                {STATES.map((state) => (
                  <QuestNode
                    key={state}
                    kind={kind}
                    state={state}
                    title={kind === undefined ? undefined : `A ${kind} node`}
                    onPress={() => undefined}
                  />
                ))}
              </div>
            </Specimen>
          ))}
          <Specimen name="QuestNode chosen, showing" note="open; hovered, pressed, focused; nothing to open">
            <div className="showcase__try">
              <QuestNode kind="checklist" state="current" title="Open" chosen onPress={() => undefined} />
              {(['hover', 'pressed', 'focus'] as const).map((showing) => (
                <QuestNode
                  key={showing}
                  kind="reward"
                  state="ahead"
                  title={showing}
                  showing={showing}
                  onPress={() => undefined}
                />
              ))}
              <QuestNode kind="dialogue" state="done" title="Not pressable" />
            </div>
          </Specimen>
          <Specimen name="QuestNode size" note="32, 44 and 64 pixels">
            <div className="showcase__try">
              {[32, 44, 64].map((size) => (
                <QuestNode key={size} kind="dialogue" state="current" size={size} title={`${size}`} />
              ))}
            </div>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="The map">
        <Specimens>
          <Specimen
            name="QuestMap at the start"
            note="the abbot lit; two question marks ahead, one shown half-way down"
            wide
          >
            <div style={{ width: 380 }}>
              <Container recipe="pane.right">
                <QuestMap nodes={AT_THE_START} edges={ROADS} width={300} label="The abbot of the isle" />
              </Container>
            </div>
          </Specimen>
          <Specimen
            name="QuestMap on a road"
            note="walked in gilt; the road not taken lost; press a node to open it"
            wide
          >
            <div style={{ width: 380 }}>
              <Container recipe="pane.right">
                <QuestMap
                  nodes={ON_THE_BAD_ROAD}
                  edges={WALKED}
                  width={300}
                  chosen={open}
                  onPress={(id) => setOpen((was) => (was === id ? undefined : id))}
                  label="The abbot of the isle"
                />
              </Container>
            </div>
          </Specimen>
          <Specimen
            name="QuestMap with stubs"
            note="a node not drawn: a stub out of the one before, one into the one after"
            wide
          >
            <div style={{ width: 380 }}>
              <Container recipe="pane.right">
                <QuestMap nodes={WITH_STUBS} edges={STUBS} width={240} label="A letter" />
              </Container>
            </div>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="The checklist">
        <Specimens>
          <Specimen name="ChecklistRow" note="the player's to meet; press deliver" wide>
            <Container recipe="pane.right">{checklist}</Container>
          </Specimen>
          <Specimen name="ChecklistRow on parchment" note="the card under a quest's map" wide>
            <Container recipe="card.figure">{checklist}</Container>
          </Specimen>
          <Specimen name="MarkButton collect" note="what a reward waits with">
            <div className="showcase__try">
              <QuestNode kind="reward" state="current" title="The abbot's blessing" />
              <MarkButton label="Collect the blessing" mark="collect" onClick={() => undefined} />
              <MarkButton label="Collect the blessing" mark="collect" disabled />
            </div>
          </Specimen>
        </Specimens>
      </Part>
    </>
  );
}
