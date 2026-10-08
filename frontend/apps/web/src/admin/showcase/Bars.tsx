import './bars.css';

import { useState } from 'react';

import { usePictures } from '../../ui/art/pictures';
import { BottomBar } from '../../ui/bar/BottomBar';
import type { BarButton } from '../../ui/bar/BottomBar';
import type { Showing } from '../../ui/button/Button';
import { Part, Specimen, Specimens } from './Specimen';

/** A phone's panes, as the game's bar will have them: marks and no words, Adam's call of 2026-10-08. */
const PANES: readonly BarButton[] = [
  { id: 'house', label: 'Your house', mark: 'house' },
  { id: 'figures', label: 'Key figures', mark: 'figures' },
  { id: 'letter', label: 'A letter', mark: 'letter' },
  { id: 'dialogues', label: 'Dialogues', mark: 'dialogues' },
  { id: 'recent', label: 'Recent', mark: 'recent' },
];

/** Every state a mark of the bar is drawn in, side by side, the first of them lit. */
const STATES: readonly BarButton[] = [
  { id: 'lit', label: 'Lit', mark: 'house' },
  { id: 'rest', label: 'At rest', mark: 'figures' },
  { id: 'hover', label: 'Hovered', mark: 'letter', showing: 'hover' },
  { id: 'pressed', label: 'Pressed', mark: 'dialogues', showing: 'pressed' },
  { id: 'focus', label: 'Focused', mark: 'recent', showing: 'focus' },
  { id: 'disabled', label: 'Disabled', mark: 'map', disabled: true },
];

/** The lit one in each state a pointer or the keyboard can put it in, and what each is called. */
const LIT_STATES: Readonly<Record<Showing, string>> = {
  hover: 'hovered',
  pressed: 'pressed',
  focus: 'focused',
};

const nothing = () => undefined;

export function Bars() {
  const { list, problem } = usePictures();
  const [across, setAcross] = useState<string | null>('house');
  const [down, setDown] = useState<string | null>('figures');
  const [said, say] = useState('nothing pressed yet');
  if (list === null) {
    return <p className="showcase__to-come">{problem ?? 'Reading the pictures…'}</p>;
  }

  // What the game will do with a press, near enough to see it work: a mark lights, and the lit one pressed
  // again goes out, as the bottom pane is put away.
  const pressing = (set: (id: string | null) => void, now: string | null) => (id: string) => {
    set(id === now ? null : id);
    say(id === now ? `${id}, pressed again: none lit` : `${id}, lit`);
  };

  return (
    <Part title="The bottom bar">
      <p className="ui-label showcase__lead">
        A phone&rsquo;s way between its panes: a mark a pane, an even share each, the lit one on the chosen
        tab&rsquo;s parchment opening into the pane above it. Press one; press the lit one again and it goes
        out. Tab to it and go along with the arrow keys, either pair; Enter presses.{' '}
        <span className="showcase__said">{said}</span>
      </p>
      <Specimens>
        <Specimen name="BottomBar" note="five panes, as wide as a phone" wide>
          <div className="showcase__bar-across">
            <BottomBar
              buttons={PANES}
              chosen={across}
              onPress={pressing(setAcross, across)}
              label="What is in the bottom"
            />
          </div>
        </Specimen>
        {[3, 4].map((count) => (
          <Specimen key={count} name="BottomBar" note={`${count} panes`} wide>
            <div className="showcase__bar-across">
              <BottomBar
                buttons={PANES.slice(0, count)}
                chosen="house"
                onPress={nothing}
                label={`${count} panes`}
              />
            </div>
          </Specimen>
        ))}
        <Specimen name="BottomBar chosen={null}" note="none lit" wide>
          <div className="showcase__bar-across">
            <BottomBar buttons={PANES} chosen={null} onPress={nothing} label="None lit" />
          </div>
        </Specimen>
        <Specimen
          name="BottomBar"
          note={['every state of a mark', 'lit, at rest, hovered, pressed, focused, disabled']}
          wide
        >
          <div className="showcase__bar-across">
            <BottomBar buttons={STATES} chosen="lit" onPress={nothing} label="Every state" />
          </div>
        </Specimen>
        {(Object.keys(LIT_STATES) as Showing[]).map((showing) => (
          <Specimen key={showing} name="BottomBar" note={`the lit one ${LIT_STATES[showing]}`}>
            <div className="showcase__bar-across showcase__bar-across--short">
              <BottomBar
                buttons={PANES.slice(0, 3).map((pane, at) => (at === 0 ? { ...pane, showing } : pane))}
                chosen="house"
                onPress={nothing}
                label={`Lit and ${showing}`}
              />
            </div>
          </Specimen>
        ))}
        <Specimen
          name={'BottomBar along="down"'}
          note={['turned, down the right of a turned phone', 'the lit one opens to its left']}
        >
          <div className="showcase__bar-down">
            <BottomBar
              buttons={PANES}
              chosen={down}
              onPress={pressing(setDown, down)}
              label="What is on the right"
              along="down"
            />
          </div>
        </Specimen>
        <Specimen name={'BottomBar along="down"'} note="every state of a mark, turned">
          <div className="showcase__bar-down">
            <BottomBar
              buttons={STATES}
              chosen="lit"
              onPress={nothing}
              label="Every state, turned"
              along="down"
            />
          </div>
        </Specimen>
      </Specimens>
    </Part>
  );
}
