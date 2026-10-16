/**
 * The pools and the actions a choice roll deals from, `world/catalogues/fate.json`, as the inspect page reads them:
 * each pool and the omen keys it opens on, each action with its rarity, its pools, its words and what it deals - a
 * grant of a resource, or gossip. Strict as the server's reader is: one it cannot read refuses the file, naming where.
 * Held to the server's reader by `contracts/fixtures/fate.json`. See decision record 0097.
 */

import { RARITIES } from './balance.ts';
import type { BalanceRarity } from './balance.ts';

/** The resources an action can grant, by the names the wire gives them. */
export const FATE_RESOURCES = ['wealth', 'naturalDomain', 'influence', 'reason', 'piety'] as const;
export type FateResource = (typeof FATE_RESOURCES)[number];

export interface FatePool {
  readonly name: string;
  /** Omen keys exactly, or, ending in `*`, every key beginning with what comes before it. */
  readonly opensOn: readonly string[];
}

export type FateDeals =
  | { readonly kind: 'grant'; readonly resource: FateResource }
  | {
      readonly kind: 'gossip';
      readonly spreads: number;
      readonly heardOfKm: number;
      readonly rumours: readonly string[];
    };

export interface FateAction {
  readonly id: string;
  readonly rarity: BalanceRarity;
  readonly pools: readonly string[];
  readonly label: string;
  readonly detail: string;
  readonly deals: FateDeals;
}

export interface Fate {
  readonly pools: readonly FatePool[];
  readonly actions: readonly FateAction[];
  /** What the file, its pools and its actions say of themselves, by `''`, `pools` and `actions`. */
  readonly said: Readonly<Record<string, string>>;
}

type Node = Record<string, unknown>;

const isObject = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function refuse(at: string): never {
  throw new Error(`world/catalogues/fate.json: no ${at} the page can read`);
}

/** An object's fields, leaving out what begins `$`, which says what the rest are. */
const fieldsOf = (node: Node) => Object.entries(node).filter(([key]) => !key.startsWith('$'));

function words(value: unknown, at: string): string[] {
  if (!Array.isArray(value) || !value.every((one) => typeof one === 'string')) refuse(at);
  return value as string[];
}

function word(node: Node, field: string, at: string): string {
  const value = node[field];
  return typeof value === 'string' && value.trim() !== '' ? value : refuse(`${at}.${field}`);
}

function dealsOf(node: Node, at: string): FateDeals {
  const { grants, gossip } = node;
  if (grants !== undefined && gossip === undefined) {
    if (!FATE_RESOURCES.includes(grants as FateResource)) refuse(`${at}.grants`);
    return { kind: 'grant', resource: grants as FateResource };
  }
  if (gossip !== undefined && grants === undefined && isObject(gossip)) {
    const { spreads, heardOfKm } = gossip;
    if (typeof spreads !== 'number' || !Number.isInteger(spreads)) refuse(`${at}.gossip.spreads`);
    if (typeof heardOfKm !== 'number') refuse(`${at}.gossip.heardOfKm`);
    const rumours = words(gossip.rumours, `${at}.gossip.rumours`);
    if (rumours.length === 0) refuse(`${at}.gossip.rumours`);
    return { kind: 'gossip', spreads, heardOfKm, rumours };
  }
  return refuse(`${at}.grants or gossip, and only one,`);
}

function actionOf(id: string, node: unknown): FateAction {
  const at = `actions.${id}`;
  if (!isObject(node)) refuse(at);
  if (!RARITIES.includes(node.rarity as BalanceRarity)) refuse(`${at}.rarity`);
  return {
    id,
    rarity: node.rarity as BalanceRarity,
    pools: words(node.pools, `${at}.pools`),
    label: word(node, 'label', at),
    detail: word(node, 'detail', at),
    deals: dealsOf(node, at),
  };
}

/** The pools and actions in `text`, or an error naming the first field that cannot be read. */
export function parseFate(text: string): Fate {
  const file: unknown = JSON.parse(text);
  if (!isObject(file)) refuse('the file');
  const pools = isObject(file.pools) ? file.pools : refuse('pools');
  const actions = isObject(file.actions) ? file.actions : refuse('actions');
  const comment = (node: Node) => (typeof node.$comment === 'string' ? node.$comment : '');
  return {
    pools: fieldsOf(pools).map(([name, keys]) => ({ name, opensOn: words(keys, `pools.${name}`) })),
    actions: fieldsOf(actions).map(([id, node]) => actionOf(id, node)),
    said: { '': comment(file), pools: comment(pools), actions: comment(actions) },
  };
}
