import type { SliceView } from '@villages/protocol';
import { pictureKey } from '@villages/world';
import type { Challenges } from '@villages/world';

import type { Placed, Standing } from '../ui/diorama/Diorama';
import { FieldFigure } from '../ui/fieldFigure/FieldFigure';
import { FieldTag } from '../ui/fieldFigure/FieldTag';
import type { Field, OnField, SideKey } from './replay';
import { aspectShown, borneOf, speakerOf } from './said';
import { building, scenery } from './sheets';
import type { Sheets } from './sheets';
import type { HouseShown } from './said';
import { blockPlaced, PLATFORM } from './venues/blocks';
import { townsfolkPlaces, townsfolkSides } from './venues/townsfolk';
import type { Arrangement, Point } from './venues/venue';

const SIDES: readonly SideKey[] = ['a', 'b'];
const TOWNSFOLK = 20;

/** The map's building a thing put on the line stands as, by the effect that put it there. */
const ON_THE_LINE: Readonly<Record<string, string>> = {
  'holy.sanctuary': 'cathedral',
  'greed.countingHouse': 'market',
  'industry.works': 'manufactory',
};

/**
 * A side's summons in the order they came, each with the place it takes: when there are more than places, the next
 * round stands two cells further out along the lattice, left for the first house and right for the second.
 */
function placesOf(
  standing: readonly OnField[],
  side: SideKey,
  arrangement: Arrangement,
): (OnField & Point)[] {
  const places = arrangement.summons[side];
  const out = side === 'a' ? -2 : 2;
  return standing
    .filter((one) => one.side === side && !one.onTheLine)
    .sort((one, other) => one.arrived - other.arrived || one.serial - other.serial)
    .map((one, at) => {
      const place = places[at % places.length]!;
      const round = Math.floor(at / places.length) * out;
      return {
        ...one,
        x: place.x + round * arrangement.lattice.u.x,
        y: place.y + round * arrangement.lattice.u.y,
      };
    });
}

/** Everything standing in the venue at a second: the map's pictures, the platforms, speakers, summons, townsfolk. */
export function standingOf(
  field: Field,
  arrangement: Arrangement,
  sheets: Sheets,
  sides: Readonly<Record<SideKey, readonly SliceView[]>>,
  houses: Readonly<Record<SideKey, HouseShown>>,
  content: Challenges,
): { pictures: Standing[]; placed: Placed[] } {
  const s = field.second;
  const pictures: Standing[] = [];
  const placed: Placed[] = [];
  for (const one of arrangement.buildings) {
    const picture = building(sheets, pictureKey(one.picture, 'european'), one.x, one.y, one.height);
    if (picture !== null) pictures.push(picture);
  }
  for (const one of arrangement.trees) {
    const picture = scenery(sheets, one.kind, one.x, one.y, one.height);
    if (picture !== null) pictures.push(picture);
  }
  const lit = (one: OnField) => one.bearing.some((bearing) => bearing.id === 'empowered');
  for (const side of SIDES) {
    const facing = side === 'a' ? 'east' : 'west';
    const platform = arrangement.platforms[side];
    const lift = PLATFORM.lift * arrangement.cell;
    placed.push(
      blockPlaced(`platform-${side}`, arrangement.lattice, platform, PLATFORM.cells, lift, PLATFORM.faces),
    );
    const speaker = speakerOf(sides[side]);
    const spoke = field.slices[side].reduce((sum, slice) => sum + (field.pulled.get(slice.actor) ?? 0), 0);
    placed.push({
      id: `speaker-${side}`,
      x: platform.x,
      y: platform.y - lift,
      node: (
        <FieldFigure
          kind="keyFigure"
          facing={facing}
          colour={houses[side].colour}
          height={arrangement.figure}
          name={speaker ?? `${houses[side].name}’s speaker`}
          pulled={spoke === 0 ? undefined : { amount: spoke, key: s }}
        />
      ),
    });
    for (const one of placesOf(field.standing, side, arrangement)) {
      const pulled = field.pulled.get(`#${one.serial}`);
      placed.push({
        id: `summon-${one.serial}`,
        x: one.x,
        y: one.y,
        walk: 0.9,
        node: (
          <FieldFigure
            kind="summon"
            facing={facing}
            colour={houses[side].colour}
            height={arrangement.figure}
            name={`${one.name} #${one.serial}`}
            {...(one.aspect === null ? {} : { aspect: aspectShown(one.aspect) })}
            lit={lit(one)}
            borne={borneOf(
              one.bearing.filter((bearing) => bearing.id !== 'empowered'),
              content,
              s,
            )}
            pulled={pulled === undefined ? undefined : { amount: pulled, key: s }}
            fallen={one.fell !== null}
          />
        ),
      });
    }
    field.standing
      .filter((one) => one.side === side && one.onTheLine)
      .forEach((one, at) => {
        const place = arrangement.onTheLine[side][at % arrangement.onTheLine[side].length]!;
        const pulled = field.pulled.get(`#${one.serial}`);
        const key = pictureKey(ON_THE_LINE[one.effect ?? ''] ?? 'manor', 'european');
        const picture = building(
          sheets,
          key,
          place.x,
          place.y,
          arrangement.lineHeight,
          one.fell === null ? 1 : 0.5,
        );
        if (picture !== null) pictures.push({ ...picture, id: `line-${one.serial}` });
        const width =
          picture === null
            ? arrangement.lineHeight
            : (picture.frame.width / picture.frame.height) * picture.height;
        placed.push({
          id: `line-tag-${one.serial}`,
          x: place.x,
          y: place.y,
          depth: place.y - 1,
          node: (
            <FieldTag
              name={one.name}
              width={width}
              height={arrangement.lineHeight}
              lit={lit(one)}
              pulled={pulled === undefined ? undefined : { amount: pulled, key: s }}
            />
          ),
        });
      });
  }
  townsfolkPlaces(townsfolkSides(field.tug, TOWNSFOLK), arrangement.townsfolk).forEach((place, at) => {
    const side = townsfolkSides(field.tug, TOWNSFOLK)[at]!;
    placed.push({
      id: `townsperson-${at}`,
      x: place.x,
      y: place.y,
      walk: 1.4,
      node: (
        <FieldFigure
          kind="townsperson"
          facing={side === 'a' ? 'west' : 'east'}
          height={Math.round(arrangement.figure * 0.8)}
        />
      ),
    });
  });
  return { pictures, placed };
}
