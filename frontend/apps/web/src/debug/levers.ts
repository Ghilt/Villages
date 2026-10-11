import type {
  BannerSpec,
  KeyFigureView,
  Point,
  Rarity,
  ResourceName,
  StatName,
  VisionPointView,
} from '@villages/protocol';

import { STAT_WORDS, fullName } from '../figures/describe';
import { shortId } from '../log/log';
import { pull } from '../net/gateway';

/*
 * The debug panel's levers, each a real command sent the way every command goes - see `pull` in the page's
 * gateway module - and each said in the part of the log it belongs to, its answer beside it. They stand in for
 * what the world will one day do; what the player does is the player's own, in the panes. See decision record
 * 0023, and 0076 for the setting that closes them on a server.
 */

/** Founds this player's one house at a place, from the World section. Pressed twice, the second is refused. */
export function foundHouseHere(seat: Point, name: string, banner: BannerSpec): void {
  pull('command', `founding a house at ${seat.lat.toFixed(3)}, ${seat.lon.toFixed(3)}`, {
    type: 'foundHouse',
    name,
    seat,
    banner,
  });
}

/*
 * Doing something to what your house has.
 *
 * Granting and spending are **Adam's levers** for now rather than a player's: nothing in the game gives a
 * house anything yet. They are here so that what the domain can do can be made to happen and watched.
 */

export function grantResource(resource: ResourceName, amount: number): void {
  pull('resources', `granting ${amount} ${resource}`, { type: 'grantResource', resource, amount });
}

export function spendResource(resource: ResourceName, amount: number): void {
  pull('resources', `spending ${amount} ${resource}`, { type: 'spendResource', resource, amount });
}

export function pledgeResource(
  resource: ResourceName,
  amount: number,
  months: number,
  purpose: string,
): void {
  pull('resources', `pledging ${amount} ${resource} for ${months} ${months === 1 ? 'month' : 'months'}`, {
    type: 'pledgeResource',
    resource,
    amount,
    months,
    purpose,
  });
}

export function releasePledge(pledgeId: string): void {
  pull('resources', `releasing pledge ${shortId(pledgeId)}`, { type: 'releasePledge', pledgeId });
}

/*
 * Doing something to your house's key figures.
 *
 * **Adam's levers**, like the resources': a house takes key figures in only from the debug panel, and
 * nothing in the game changes a stat or kills anyone yet. Every one that names a character is refused
 * `noSuchKeyFigure` unless the character is this house's own. See decision record 0055.
 */

export function addKeyFigure(): void {
  pull('characters', 'taking a key figure in', { type: 'addKeyFigure' });
}

export function changeStat(figure: KeyFigureView, stat: StatName, by: number): void {
  const way = by > 0 ? 'raising' : 'lowering';
  pull('characters', `${way} ${fullName(figure)}'s ${STAT_WORDS[stat].toLowerCase()} by ${Math.abs(by)}`, {
    type: 'changeStat',
    characterId: figure.id,
    stat,
    by,
  });
}

export function ageCharacter(figure: KeyFigureView, years: number): void {
  const said =
    years > 0
      ? `ageing ${fullName(figure)} by ${years} years`
      : `making ${fullName(figure)} ${-years} years younger`;
  pull('characters', said, { type: 'ageCharacter', characterId: figure.id, years });
}

/** Gives somebody another portrait, or none, which is theirs from then on. */
export function changePortrait(figure: KeyFigureView, portrait: string | undefined): void {
  pull(
    'characters',
    portrait === undefined
      ? `taking ${fullName(figure)}'s portrait away`
      : `giving ${fullName(figure)} another portrait, ${portrait}`,
    portrait === undefined
      ? { type: 'changePortrait', characterId: figure.id }
      : { type: 'changePortrait', characterId: figure.id, portrait },
  );
}

/** Puts one of the house's key figures somewhere on the map; how much they matter there is the world's. */
export function moveCharacter(figure: KeyFigureView, place: Point): void {
  pull('characters', `putting ${fullName(figure)} at ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}`, {
    type: 'moveCharacter',
    characterId: figure.id,
    place,
  });
}

/*
 * Giving the house vision of a place outright, and taking it away. Adam's levers, in the Debug map section
 * under the fog switch; a storyline that gives a house sight of a far coast will send the same command. The
 * answers and the sight that follows are said in the same part of the log. See decision record 0061.
 */

export function giveVision(place: Point): void {
  pull('sight', `giving your house vision at ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}`, {
    type: 'giveVision',
    place,
  });
}

export function takeVision(point: VisionPointView): void {
  if (point.kind !== 'given' || point.of === undefined) {
    return;
  }
  pull('sight', `taking away the vision at ${point.place.lat.toFixed(3)}, ${point.place.lon.toFixed(3)}`, {
    type: 'takeVision',
    visionId: point.of,
  });
}

export function takeOffTheMap(figure: KeyFigureView): void {
  pull('characters', `taking ${fullName(figure)} off the map`, {
    type: 'takeOffTheMap',
    characterId: figure.id,
  });
}

export function killCharacter(figure: KeyFigureView, cause: string): void {
  pull('characters', `killing ${fullName(figure)}, ${cause}`, {
    type: 'killCharacter',
    characterId: figure.id,
    cause,
  });
}

/*
 * Offering the house a dialogue. Adam's lever, in the Dialogues section: nothing in the world offers one
 * yet. It names one of the server's samples and sends none of its words. See decision record 0071.
 */

export function offerDialogue(sample: string, described: string): void {
  pull('dialogues', `offering ${described}`, { type: 'offerDialogue', sample });
}

/**
 * The next roll's rarity, whatever the throw, or the throw again when null: the world's luck and not the player's
 * hand, so a legendary can be seen without a few hundred rolls. See decision record 0083.
 */
export function nextRarity(rarity: Rarity | null): void {
  pull(
    'roll',
    rarity === null ? 'putting the throw back' : `making the next roll ${rarity}`,
    rarity === null ? { type: 'nextRarity' } : { type: 'nextRarity', rarity },
  );
}

/*
 * Structures, raised where the panel looks or again in Antarctica. Adam's levers, standing in for a house building one
 * and for a story handing one over. See docs/plans/structures.md.
 */

/** Raises a structure of a type at a level at a place, this player's house's or nobody's. */
export function raiseStructure(structureType: string, level: number, place: Point, yours: boolean): void {
  pull(
    'structures',
    `raising a ${structureType} of level ${level} at ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}, ${yours ? 'yours' : "nobody's"}`,
    { type: 'raiseStructure', structureType, level, place, yours },
  );
}

/** Hands a structure to this player's house: *take control of this building*. */
export function takeControl(structureId: string, name: string): void {
  pull('structures', `taking control of ${name}`, { type: 'takeControl', structureId });
}

/** Raises or lowers a structure one level: *level up* and *level down*. */
export function changeLevel(structureId: string, name: string, by: 1 | -1): void {
  pull('structures', `${by > 0 ? 'raising' : 'lowering'} ${name} a level`, {
    type: 'changeLevel',
    structureId,
    by,
  });
}

/** Brings a structure down to ruin, by fire: *ruin this building*. */
export function ruinStructure(structureId: string, name: string): void {
  pull('structures', `ruining ${name}, by fire`, { type: 'ruinStructure', structureId, cause: 'fire' });
}

/** Raises a ruin again as what it was, at its first level, for nobody: *rebuild this building*. */
export function rebuildStructure(structureId: string, name: string): void {
  pull('structures', `rebuilding ${name}`, { type: 'rebuildStructure', structureId });
}

/** Raises whichever of the sixteen in Antarctica a wipe took. */
export function raiseAntarctica(): void {
  pull('structures', "raising Antarctica's sixteen again", { type: 'raiseAntarctica' });
}
