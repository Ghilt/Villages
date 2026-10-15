import { useEffect, useState } from 'react';

import { PinGroup, SheetPicture } from '../../ui/pinGroup/PinGroup';
import type { PinGroupMember } from '../../ui/pinGroup/PinGroup';
import { Part, Specimen, Specimens } from './Specimen';

/** The structures' atlas `world:structures` cuts, which holds every type's pin keyed `mark:<type>`. */
const ATLAS = '/art/structures';

interface Sheet {
  version: string;
  width: number;
  height: number;
  frames: Record<string, { x: number; y: number; width: number; height: number }>;
}

const TYPES = ['palace', 'castle', 'abbey', 'fort', 'manor', 'mill', 'mine', 'market', 'prison', 'harbour'];

/** A crowd of `count` of the cut pins, in rank order, one of them with a name too long for its cell. */
function crowd(sheet: Sheet, count: number, long = false): PinGroupMember[] {
  return Array.from({ length: count }, (_, at) => {
    const type = TYPES[at % TYPES.length]!;
    const frame = sheet.frames[`mark:${type}`];
    return {
      id: `${type}-${at}`,
      name: long && at === 1 ? 'the Antarctic printing house of the lower town' : `the ${type}`,
      picture:
        frame === undefined ? null : (
          <SheetPicture src={`${ATLAS}.webp?v=${sheet.version}`} sheet={sheet} frame={frame} height={40} />
        ),
    };
  });
}

/** The card a crowd of marks opens into, at three sizes of crowd, with the cut pins. */
export function PinGroups() {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [picked, setPicked] = useState('nothing yet');
  useEffect(() => {
    void fetch(`${ATLAS}.json`, { cache: 'no-store' })
      .then((answer) => (answer.ok ? (answer.json() as Promise<Sheet>) : null))
      .then(setSheet)
      .catch(() => setSheet(null));
  }, []);
  const onPick = (id: string, how: { closer: boolean }) =>
    setPicked(`${id}${how.closer ? ', to go closer to' : ''}`);

  return (
    <Part title="Crowds of marks">
      {sheet === null ? (
        <p>No pins cut in this tree: npm run world:structures --prefix frontend.</p>
      ) : (
        <Specimens>
          <Specimen
            wide
            name="Two"
            note={`Picked: ${picked}. Ctrl or Cmd with a press picks it to go closer to.`}
          >
            <PinGroup members={crowd(sheet, 2)} onPick={onPick} />
          </Specimen>
          <Specimen
            wide
            name="Nine, a name too long"
            note="Five across, the second name cut short; its whole is the pin's title."
          >
            <PinGroup members={crowd(sheet, 9, true)} onPick={onPick} />
          </Specimen>
          <Specimen wide name="Thirty" note="More than fit: the card scrolls inside itself.">
            <PinGroup members={crowd(sheet, 30)} onPick={onPick} />
          </Specimen>
        </Specimens>
      )}
    </Part>
  );
}
