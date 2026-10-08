import './bars.css';

import { useState } from 'react';

import { usePictures } from '../../ui/art/pictures';
import { BottomBar } from '../../ui/bar/BottomBar';
import type { BarButton } from '../../ui/bar/BottomBar';
import { TopBar } from '../../ui/bar/TopBar';
import { MarkButton } from '../../ui/button/Button';
import type { Showing } from '../../ui/button/Button';
import { Container } from '../../ui/container/Container';
import { Tag } from '../../ui/tag/Tag';
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

/** What stands at a top bar's far end in the game: its size control, and on a window its close. */
function Controls({ close = false }: { close?: boolean }) {
  return (
    <>
      <MarkButton label="Put it away" face="minimise" size="small" />
      <MarkButton label="Open it out" face="maximise" size="small" />
      {close && <MarkButton label="Close it" face="close" size="small" />}
    </>
  );
}

/** A window's name too long for a phone's width, which trims rather than wraps. */
const LONG = 'The Most Serene Republic of Venice and its Dominions on the Mainland';

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
    <>
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

      <Part title="The top bar">
        <p className="ui-label showcase__lead">
          What is on top of a phone, the map or a window, in one band a strip thick: its mark, its name, a
          word beside the name, and its controls at the far end. Put away, a pane on top is this and nothing
          else. Turned, it is a sliver down the side with the name reading down.
        </p>
        <Specimens>
          <Specimen name="TopBar" note="the map, as wide as a phone" wide>
            <div className="showcase__bar-across">
              <TopBar mark="map" kind="The map" name="The map" end={<Controls />} />
            </div>
          </Specimen>
          <Specimen name="TopBar beside" note="a window, how fresh it is beside its name, and its close" wide>
            <div className="showcase__bar-across">
              <TopBar
                mark="house"
                kind="A house"
                name="Kettleby"
                beside={<Tag title="What is shown of it is current">current</Tag>}
                end={<Controls close />}
              />
            </div>
          </Specimen>
          <Specimen name="TopBar" note="a name too long for the bar, trimmed" wide>
            <div className="showcase__bar-across">
              <TopBar
                mark="area"
                kind="An area"
                name={LONG}
                beside={<Tag title="Last seen on the 4th of March 1793">4 Mar 1793</Tag>}
                end={<Controls close />}
              />
            </div>
          </Specimen>
          <Specimen name="TopBar framed={false}" note="inside something already framed: a window on top" wide>
            <div className="showcase__bar-across showcase__bar-framed">
              <Container recipe="pane.rail" fills>
                <TopBar
                  mark="river"
                  kind="A river"
                  name="The Tagus"
                  end={<Controls close />}
                  framed={false}
                />
              </Container>
            </div>
          </Specimen>
          <Specimen name="TopBar turned" note={['the map put away on a turned phone', 'controls at the top']}>
            <div className="showcase__bar-down">
              <TopBar mark="map" kind="The map" name="The map" end={<Controls />} turned />
            </div>
          </Specimen>
          <Specimen name="TopBar turned" note="a window put away, turned, its name trimmed">
            <div className="showcase__bar-down">
              <TopBar mark="sea" kind="A sea" name={LONG} end={<Controls close />} turned />
            </div>
          </Specimen>
          <Specimen name="TopBar" note="every mark a pane on top can carry">
            <div className="showcase__top-marks">
              {(['map', 'house', 'figures', 'area', 'river', 'lake', 'sea'] as const).map((mark) => (
                <TopBar key={mark} mark={mark} kind={mark} name={mark} />
              ))}
            </div>
          </Specimen>
        </Specimens>
      </Part>
    </>
  );
}
