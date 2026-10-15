import './quest.css';

import { QuestNode } from './QuestNode';
import type { QuestNodeKind, QuestNodeState } from './QuestNode';
import { footOf, headOf, heightOf, pathOf, placeOf } from './mapLayout';
import type { Placing, Spacing } from './mapLayout';

/** A node on the map: where it is placed, and what the node shows. */
export interface MapNode extends Placing {
  readonly id: string;
  readonly kind?: QuestNodeKind;
  readonly state: QuestNodeState;
  readonly title?: string;
}

/** An edge on the map, between two nodes by id; an end left out is a node not drawn, and the edge a stub. */
export interface MapEdge {
  readonly from?: string;
  readonly to?: string;
  readonly state: 'walked' | 'ahead' | 'lost';
}

/**
 * A quest's map: its nodes placed row by row from the top down, and the edges between them drawn under them -
 * walked in gilt, ahead in fine dashes, lost faded - with a stub where an edge leads to a node not drawn. Where each
 * node goes is the caller's to say, by row and column; the map only lays them out across its width. A node pressed
 * says so by its id. See decision record 0096 and docs/UI-COMPONENTS.md.
 */
export function QuestMap({
  nodes,
  edges,
  width,
  rowHeight = 112,
  nodeSize = 44,
  onPress,
  chosen,
  label,
}: {
  nodes: readonly MapNode[];
  edges: readonly MapEdge[];
  width: number;
  rowHeight?: number;
  nodeSize?: number;
  /** A node pressed, by its id; a map without it presses nothing. */
  onPress?: (id: string) => void;
  /** The node that is open, by its id. */
  chosen?: string;
  /** What it is, for a screen reader: the quest's title. */
  label?: string;
}) {
  const spacing: Spacing = { width, rowHeight, nodeSize };
  const places = new Map(nodes.map((node) => [node.id, placeOf(node, spacing)]));
  const titled = new Set(nodes.filter((node) => node.title !== undefined).map((node) => node.id));
  const rows = nodes.reduce((deepest, node) => Math.max(deepest, node.row + 1), 0);
  const height = heightOf(rows, spacing);
  return (
    <div className="ui-quest-map" style={{ width, height }} role="group" aria-label={label}>
      <svg className="ui-quest-map__edges" width={width} height={height} aria-hidden>
        {edges.map((edge, index) => {
          const leaving = edge.from === undefined ? undefined : places.get(edge.from);
          const reaching = edge.to === undefined ? undefined : places.get(edge.to);
          const d = pathOf(
            leaving && footOf(leaving, spacing, titled.has(edge.from!)),
            reaching && headOf(reaching, spacing),
          );
          const stub = edge.from === undefined || edge.to === undefined;
          return d === null ? null : (
            <path
              key={`${edge.from ?? ''}>${edge.to ?? ''}#${index}`}
              d={d}
              className={`ui-quest-map__edge ui-quest-map__edge--${edge.state}${stub ? ' ui-quest-map__edge--stub' : ''}`}
            />
          );
        })}
      </svg>
      {nodes.map((node) => {
        const at = places.get(node.id)!;
        return (
          <span key={node.id} className="ui-quest-map__node" style={{ left: at.x, top: at.y - nodeSize / 2 }}>
            <QuestNode
              kind={node.kind}
              state={node.state}
              title={node.title}
              size={nodeSize}
              chosen={chosen === node.id}
              {...(onPress === undefined ? {} : { onPress: () => onPress(node.id) })}
            />
          </span>
        );
      })}
    </div>
  );
}
