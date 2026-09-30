import { useState } from 'react';

import { usePictures } from '../../ui/art/pictures';
import { MarkButton, StateButton, TextButton, WindowControls } from '../../ui/button/Button';
import type { Showing } from '../../ui/button/Button';
import { BUTTON_HEIGHTS } from '../../ui/button/face';
import type { ButtonSize } from '../../ui/button/face';
import type { MarkName } from '../../ui/mark/Mark';
import { Part, Specimen, Specimens } from './Specimen';

/** Every state a button is shown in, side by side, rather than left for the pointer to find. */
const STATES: readonly { readonly name: string; readonly showing?: Showing; readonly disabled?: boolean }[] =
  [
    { name: 'at rest' },
    { name: 'hovered', showing: 'hover' },
    { name: 'pressed', showing: 'pressed' },
    { name: 'focused', showing: 'focus' },
    { name: 'disabled', disabled: true },
  ];

const SIZES = Object.keys(BUTTON_HEIGHTS) as ButtonSize[];

const TEXT_FACES = ['primary', 'secondary', 'oval'];

/** The moodboard's round buttons, their marks painted in. */
const PAINTED_FACES = ['close', 'minimise', 'maximise', 'previous', 'next'];

/** The library's own marks, drawn on the plain round face. */
const DRAWN_MARKS: readonly MarkName[] = ['close', 'minimise', 'maximise', 'previous', 'next'];

const EYE = {
  marks: { on: 'eye-open', off: 'eye-shut' },
  labels: { on: 'Stop keeping your holdings in sight', off: 'Keep your holdings in sight' },
} as const;

export function Buttons() {
  const { list, problem } = usePictures();
  const [said, say] = useState('nothing pressed yet');
  const [open, setOpen] = useState(false);
  const [presses, setPresses] = useState(0);
  if (list === null) {
    return <p className="showcase__to-come">{problem ?? 'Reading the pictures…'}</p>;
  }
  return (
    <>
      <Part title="Try them">
        <p className="ui-label showcase__lead">
          Real ones, to point at, press and tab to. <span className="showcase__said">{said}</span>
        </p>
        <div className="showcase__try">
          <TextButton
            onClick={() => {
              setPresses((was) => was + 1);
              say(`Found a house here, pressed ${presses + 1} ${presses === 0 ? 'time' : 'times'}`);
            }}
          >
            Found a house here
          </TextButton>
          <TextButton face="secondary" onClick={() => say('Not now, pressed')}>
            Not now
          </TextButton>
          <StateButton
            on={open}
            onChange={(now) => {
              setOpen(now);
              say(now ? 'the eye is open' : 'the eye is shut');
            }}
            marks={EYE.marks}
            labels={EYE.labels}
          />
          <MarkButton label="Close it" face="close" onClick={() => say('close, pressed')} />
          <WindowControls
            size="regular"
            onMinimise={() => say('put away, pressed')}
            onMaximise={() => say('opened out, pressed')}
            onClose={() => say('closed, pressed')}
          />
        </div>
      </Part>

      <Part title="Text buttons">
        <p className="ui-label showcase__lead">
          Words on a face that stretches between its end caps to fit them. Every state, then the three sizes.
        </p>
        {TEXT_FACES.map((face) => (
          <Specimens key={face}>
            {STATES.map((state) => (
              <Specimen key={state.name} name={`TextButton face="${face}"`} note={state.name}>
                <TextButton
                  face={face}
                  {...(state.showing === undefined ? {} : { showing: state.showing })}
                  disabled={state.disabled === true}
                >
                  Found a house
                </TextButton>
              </Specimen>
            ))}
          </Specimens>
        ))}
        <Specimens>
          {SIZES.map((size) => (
            <Specimen key={size} name={`size="${size}"`} note={`${BUTTON_HEIGHTS[size]} pixels tall`}>
              <TextButton size={size}>Found a house</TextButton>
            </Specimen>
          ))}
          <Specimen name="the words it fits" note="one word, and a sentence" wide>
            <div className="showcase__try">
              <TextButton>Go</TextButton>
              <TextButton>Keep your holdings in sight</TextButton>
              <TextButton face="oval">Go</TextButton>
              <TextButton face="oval">Keep your holdings in sight</TextButton>
            </div>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Mark buttons">
        <p className="ui-label showcase__lead">
          A mark on a round face, one size whatever it says, with what it does in words for the pointer and
          the screen reader. The moodboard’s have their marks painted in; the plain face has the library’s
          drawn ones on it. Which a button is, is Adam’s call each time.
        </p>
        {PAINTED_FACES.map((face) => (
          <Specimens key={face}>
            {STATES.map((state) => (
              <Specimen key={state.name} name={`MarkButton face="${face}"`} note={state.name}>
                <MarkButton
                  label={face}
                  face={face}
                  {...(state.showing === undefined ? {} : { showing: state.showing })}
                  disabled={state.disabled === true}
                />
              </Specimen>
            ))}
          </Specimens>
        ))}
        <Specimens>
          {DRAWN_MARKS.map((mark) => (
            <Specimen key={mark} name={`MarkButton mark="${mark}"`} note="drawn, on the plain face">
              <MarkButton label={mark} mark={mark} />
            </Specimen>
          ))}
          {SIZES.map((size) => (
            <Specimen key={size} name={`size="${size}"`} note={`${BUTTON_HEIGHTS[size]} pixels tall`}>
              <MarkButton label="close" face="close" size={size} />
            </Specimen>
          ))}
        </Specimens>
      </Part>

      <Part title="State buttons">
        <p className="ui-label showcase__lead">
          A mark that is on or off, like the eye: it says which by the mark and by the glow of being chosen,
          and in words what pressing it would do.
        </p>
        <Specimens>
          {[false, true].flatMap((on) =>
            STATES.map((state) => (
              <Specimen key={`${on}-${state.name}`} name={`StateButton on={${on}}`} note={state.name}>
                <StateButton
                  on={on}
                  onChange={() => undefined}
                  marks={EYE.marks}
                  labels={EYE.labels}
                  {...(state.showing === undefined ? {} : { showing: state.showing })}
                  disabled={state.disabled === true}
                />
              </Specimen>
            )),
          )}
        </Specimens>
      </Part>

      <Part title="Window controls">
        <p className="ui-label showcase__lead">
          The window’s three, in the order a window has them: put away, opened out, shut.
        </p>
        <Specimens>
          {SIZES.map((size) => (
            <Specimen
              key={size}
              name={`WindowControls size="${size}"`}
              note={`${BUTTON_HEIGHTS[size]} pixels tall`}
            >
              <WindowControls size={size} />
            </Specimen>
          ))}
          <Specimen name="WindowControls disabled" note="disabled">
            <WindowControls disabled />
          </Specimen>
        </Specimens>
      </Part>
    </>
  );
}
