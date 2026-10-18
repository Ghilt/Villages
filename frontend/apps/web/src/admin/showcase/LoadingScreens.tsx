import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { usePictures } from '../../ui/art/pictures';
import { TextButton } from '../../ui/button/Button';
import { Container } from '../../ui/container/Container';
import { FADE_MS, LoadingScreen } from '../../ui/loadingScreen/LoadingScreen';
import { Part, Specimen, Specimens } from './Specimen';

/** How long the opening played on the page takes to fill its meter, about as long as the game's does. */
const FILLING_MS = 2400;

/** What the screen says under its title, a placeholder until the game has its own words. */
const SAYS = 'The map is being painted';

/** What stands under the screen on the page, so a fade has something to uncover. */
function Underneath({ children }: { children?: ReactNode }) {
  return (
    <Container recipe="pane.plain" fills>
      <p className="ui-body">{children ?? 'The game, underneath.'}</p>
    </Container>
  );
}

/** The opening, played: covered, the meter filling, then lifted. Again on a press. */
function Opening() {
  const [share, setShare] = useState(0);
  const [lifted, setLifted] = useState(false);
  const [round, setRound] = useState(0);
  const [said, setSaid] = useState('filling');

  useEffect(() => {
    const started = performance.now();
    let frame = requestAnimationFrame(function fill(now) {
      const done = Math.min(1, (now - started) / FILLING_MS);
      setShare(done);
      if (done < 1) {
        frame = requestAnimationFrame(fill);
      } else {
        setLifted(true);
        setSaid('lifting');
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [round]);

  const again = () => {
    setShare(0);
    setLifted(false);
    setSaid('filling');
    setRound((was) => was + 1);
  };

  return (
    <>
      <p className="ui-label showcase__lead">
        Played as the game plays it: covered from the first frame, the meter filling as the work is done, and
        lifted, fading over {FADE_MS} milliseconds. Drag the corner to see it at another size.{' '}
        <span className="showcase__said">{said}</span>
      </p>
      <TextButton face="secondary" onClick={again}>
        Play it again
      </TextButton>
      <div className="showcase__resizable" style={{ width: 880, height: 500 }}>
        <Underneath>The game, underneath, uncovered as the screen fades.</Underneath>
        <LoadingScreen
          title="Villages"
          says={SAYS}
          share={share}
          shareSaid={`${Math.round(share * 100)} of 100`}
          lifted={lifted}
          onGone={() => setSaid('gone')}
        />
      </div>
    </>
  );
}

/**
 * Each state the screen can be held in, and at a phone's shape. Each takes a whole row, because a cell of the
 * sheet is narrower than any window the screen will ever cover.
 */
const STATES: readonly { note: string; share?: number; says?: string; width: number; height: number }[] = [
  { note: 'no figure yet: a title alone', width: 520, height: 290 },
  { note: 'a line under the title, filling, four tenths', says: SAYS, share: 0.4, width: 520, height: 290 },
  { note: 'full, about to lift', says: SAYS, share: 1, width: 520, height: 290 },
  { note: 'a phone, 360 by 640', says: SAYS, share: 0.65, width: 360, height: 640 },
];

export function LoadingScreens() {
  const { list, problem } = usePictures();
  if (list === null) {
    return <p className="showcase__to-come">{problem ?? 'Reading the pictures…'}</p>;
  }
  return (
    <>
      <Part title="The opening">
        <Opening />
      </Part>

      <Part title="Held">
        <p className="ui-label showcase__lead">
          The screen covers whatever holds it, in the colour its sky averages to until the sky&rsquo;s picture
          has arrived. The meter is shown only when there is a figure for it.
        </p>
        <Specimens>
          {STATES.map(({ note, share, says, width, height }) => (
            <Specimen key={note} name="LoadingScreen" note={note} wide>
              <div className="showcase__resizable" style={{ width, height }}>
                <Underneath />
                <LoadingScreen
                  title="Villages"
                  {...(says === undefined ? {} : { says })}
                  {...(share === undefined ? {} : { share })}
                />
              </div>
            </Specimen>
          ))}
        </Specimens>
      </Part>
    </>
  );
}
