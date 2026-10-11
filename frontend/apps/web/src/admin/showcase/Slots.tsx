import { portraitUrl } from '../../figures/portraits';
import { Socket, SlotRow } from '../../ui/socket/Socket';
import type { SocketContent } from '../../ui/socket/slots';
import religion from './pictures/religion.webp';
import { FIGURES } from './sampleFigures';
import { Part, Specimen, Specimens } from './Specimen';

/** The key figures as a socket holds them. */
const PEOPLE: readonly SocketContent[] = FIGURES.map((figure) => ({
  kind: 'portrait',
  picture: portraitUrl(figure.portrait),
  name: figure.full,
}));
const HENRI = PEOPLE[0]!;

const RELIC: SocketContent = { kind: 'item', name: 'the relic of Saint Aubert', picture: religion };
const GARRISON: SocketContent = { kind: 'item', name: 'a garrison', amount: 40 };
const GRAIN: SocketContent = { kind: 'item', name: 'bushels of grain', amount: 1300 };

/** Every kind of socket, in the order a row draws them. */
const KINDS: readonly { readonly name: string; readonly content: SocketContent; readonly note: string }[] = [
  { name: 'empty', content: { kind: 'empty' }, note: 'a place nobody has filled' },
  { name: 'portrait', content: HENRI, note: 'a person, their portrait' },
  { name: 'item', content: RELIC, note: 'a thing, its picture' },
  { name: 'item, an amount', content: GARRISON, note: 'no picture yet: the first letter, and how many' },
  { name: 'unknown', content: { kind: 'unknown' }, note: 'what the viewer is not told' },
  { name: 'more', content: { kind: 'more', count: 3 }, note: 'the last of a row too long for its room' },
];

/** The sockets and the slot's row, as a structure's window and the Holdings tab will show its slots. */
export function Slots() {
  return (
    <>
      <Part title="Socket">
        <Specimens>
          {KINDS.map((kind) => (
            <Specimen key={kind.name} name={`Socket ${kind.name}`} note={kind.note}>
              <Socket content={kind.content} />
            </Specimen>
          ))}
        </Specimens>
        <Specimens>
          <Specimen name="Socket size" note="36, 48 and 72 pixels tall, three by four">
            {[36, 48, 72].map((size) => (
              <span key={size} style={{ display: 'inline-flex', gap: 8, marginRight: 12, alignItems: 'end' }}>
                <Socket content={HENRI} size={size} />
                <Socket content={GRAIN} size={size} />
                <Socket content={{ kind: 'unknown' }} size={size} />
              </span>
            ))}
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Socket states">
        <Specimens>
          <Specimen name="onPress" note="at rest">
            <Socket content={HENRI} onPress={() => {}} />
          </Specimen>
          <Specimen name="showing hover">
            <Socket content={HENRI} onPress={() => {}} showing="hover" />
          </Specimen>
          <Specimen name="showing pressed">
            <Socket content={HENRI} onPress={() => {}} showing="pressed" />
          </Specimen>
          <Specimen name="showing focus">
            <Socket content={HENRI} onPress={() => {}} showing="focus" />
          </Specimen>
          <Specimen name="disabled">
            <Socket content={HENRI} onPress={() => {}} disabled />
          </Specimen>
        </Specimens>
      </Part>

      <Part title="SlotRow">
        <Specimens>
          <Specimen name="SlotRow" note="a castle's dungeon at level 3: two held, a place left">
            <SlotRow name="dungeon" places={3} contents={PEOPLE.slice(1, 3)} onPress={() => {}} />
          </Specimen>
          <Specimen name="SlotRow, an item" note="a fort's garrison: one place, forty men">
            <SlotRow name="garrison" places={1} contents={[GARRISON]} />
          </Specimen>
          <Specimen name="SlotRow secret" note="a prison's cells, seen by another house">
            <SlotRow name="cells" places={4} contents={PEOPLE.slice(0, 2)} secret />
          </Specimen>
          <Specimen name="SlotRow, empty" note="an abbey's library, nothing in it">
            <SlotRow name="library" places={2} contents={[]} />
          </Specimen>
          <Specimen name="SlotRow most" note="a palace's court of seven, in a row with room for five" wide>
            <SlotRow name="court" places={7} contents={PEOPLE.slice(0, 7)} most={5} onPress={() => {}} />
          </Specimen>
          <Specimen name="SlotRow, mixed" note="a cathedral's reliquary and what a story put beside it" wide>
            <SlotRow name="reliquary" places={3} contents={[RELIC, GRAIN]} size={56} />
          </Specimen>
        </Specimens>
      </Part>
    </>
  );
}
