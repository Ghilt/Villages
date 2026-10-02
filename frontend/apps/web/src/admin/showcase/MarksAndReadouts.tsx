import { useState } from 'react';

import { pictureIn, usePictures } from '../../ui/art/pictures';
import { Badged } from '../../ui/badge/Badge';
import { MarkButton, TextButton } from '../../ui/button/Button';
import { Mark, MARK_NAMES } from '../../ui/mark/Mark';
import type { MarkName } from '../../ui/mark/Mark';
import { ResourceReadout } from '../../ui/readout/ResourceReadout';
import { Tooltip } from '../../ui/tooltip/Tooltip';
import { Part, Specimen, Specimens } from './Specimen';

/** The sizes every mark is drawn at, side by side: a resource's on the house card, a button's, a pane's. */
const MARK_SIZES = [17, 24, 48];

/**
 * The house's five, as the house card has them, counting from when the page opened: made-up stocks,
 * because the page runs with no game server, at rates chosen to be seen moving.
 */
const RESOURCES: readonly {
  readonly mark: MarkName;
  readonly word: string;
  readonly total: number;
  readonly ratePerSecond: number;
}[] = [
  { mark: 'wealth', word: 'Wealth', total: 1240, ratePerSecond: 2.5 },
  { mark: 'domain', word: 'Domain', total: 12, ratePerSecond: 0 },
  { mark: 'influence', word: 'Influence', total: 340, ratePerSecond: 0.5 },
  { mark: 'reason', word: 'Reason', total: 58, ratePerSecond: 0.2 },
  { mark: 'piety', word: 'Piety', total: 96, ratePerSecond: -0.25 },
];

/** A rate in words, as the game would say it: per minute here, because per second is too small to read. */
function perMinute(ratePerSecond: number): string {
  const perMinute = Math.round(ratePerSecond * 60);
  return `${perMinute > 0 ? '+' : perMinute < 0 ? '−' : ''}${Math.abs(perMinute)} a minute`;
}

export function MarksAndReadouts() {
  const { list, problem } = usePictures();
  const [since] = useState(() => Date.now());
  if (list === null) {
    return <p className="showcase__to-come">{problem ?? 'Reading the pictures…'}</p>;
  }
  const amountAt = (total: number, ratePerSecond: number) => (now: number) =>
    Math.floor(total + (ratePerSecond * Math.max(0, now - since)) / 1000);
  return (
    <>
      <Part title="Marks">
        <p className="ui-label showcase__lead">
          Every mark at 17, 24 and 48 pixels, which is whether it reads small seen rather than argued: a
          resource’s mark is drawn at seventeen, and five of them have to be told apart in a row. Drawn, until
          a picture of the same name is saved in <code>world/ui/marks/</code>.
        </p>
        <Specimens>
          {MARK_NAMES.map((name) => (
            <Specimen
              key={name}
              name={`Mark name="${name}"`}
              note={pictureIn(list, 'marks', name) === undefined ? 'drawn' : 'painted'}
            >
              <span className="showcase__marks">
                {MARK_SIZES.map((size) => (
                  <Mark key={size} name={name} size={size} />
                ))}
              </span>
            </Specimen>
          ))}
        </Specimens>
      </Part>

      <Part title="Resource readouts">
        <p className="ui-label showcase__lead">
          The house’s five, counting from when the page opened, as they would between the events that set
          them. Point at a mark for its word.
        </p>
        <Specimens>
          <Specimen name="ResourceReadout" note="as the house card has them: marks, and nothing else" wide>
            <span className="showcase__readouts">
              {RESOURCES.map((one) => (
                <ResourceReadout
                  key={one.mark}
                  mark={one.mark}
                  word={one.word}
                  amountAt={amountAt(one.total, one.ratePerSecond)}
                  ratePerSecond={one.ratePerSecond}
                />
              ))}
            </span>
          </Specimen>
          <Specimen name="ResourceReadout showWord" note="with the word, until the marks are learnt" wide>
            <span className="showcase__readouts">
              {RESOURCES.map((one) => (
                <ResourceReadout
                  key={one.mark}
                  mark={one.mark}
                  word={one.word}
                  amountAt={amountAt(one.total, one.ratePerSecond)}
                  ratePerSecond={one.ratePerSecond}
                  showWord
                />
              ))}
            </span>
          </Specimen>
          <Specimen name="ResourceReadout rate" note="with how fast, in the game’s words" wide>
            <span className="showcase__readouts showcase__readouts--column">
              {RESOURCES.map((one) => (
                <ResourceReadout
                  key={one.mark}
                  mark={one.mark}
                  word={one.word}
                  amountAt={amountAt(one.total, one.ratePerSecond)}
                  ratePerSecond={one.ratePerSecond}
                  rate={one.ratePerSecond === 0 ? 'still' : perMinute(one.ratePerSecond)}
                  showWord
                />
              ))}
            </span>
          </Specimen>
          <Specimen
            name="ResourceReadout"
            note="with a pledge against it: free of total, in the game’s words"
          >
            <ResourceReadout mark="wealth" word="Wealth" amountAt={() => '830/1,240'} />
          </Specimen>
          <Specimen name="ResourceReadout size={24}" note="larger, where there is room">
            <ResourceReadout
              mark="influence"
              word="Influence"
              amountAt={amountAt(12480, 1.5)}
              ratePerSecond={1.5}
              size={24}
            />
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Badges">
        <p className="ui-label showcase__lead">
          A count on a mark or a button, and nothing at nought; past ninety-nine it says so rather than
          growing.
        </p>
        <Specimens>
          {[0, 1, 9, 12, 100].map((count) => (
            <Specimen
              key={count}
              name={`Badged count={${count}}`}
              note={count === 0 ? 'nothing to say' : undefined}
            >
              <Badged count={count} what="letters">
                <MarkButton label="Letters" mark="maximise" />
              </Badged>
            </Specimen>
          ))}
          <Specimen name="Badged" note="on words">
            <Badged count={3} what="new">
              <TextButton face="secondary">Letters</TextButton>
            </Badged>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Tooltips">
        <p className="ui-label showcase__lead">
          A moment after the pointer arrives, at once from the keyboard, and on a phone when a finger holds
          the thing down. The last two are held open, above and below, to be seen without pointing.
        </p>
        <Specimens>
          <Specimen name="Tooltip" note="point at it">
            <Tooltip text="What the house has to spend">
              <span className="showcase__tip-target">Wealth</span>
            </Tooltip>
          </Specimen>
          <Specimen name="Tooltip" note="tab to it">
            <Tooltip text="Founding a house takes your seat on the map">
              <TextButton size="small">Found a house</TextButton>
            </Tooltip>
          </Specimen>
          <Specimen name="Tooltip showing" note="held open, above">
            <Tooltip text="Keep your holdings in sight" showing>
              <MarkButton label="Keep your holdings in sight" mark="eye-shut" size="small" />
            </Tooltip>
          </Specimen>
          <Specimen name={'Tooltip showing prefer="below"'} note="held open, below">
            <Tooltip
              text="A longer one wraps at eighteen rem, as a sentence about a thing sometimes has to"
              showing
              prefer="below"
            >
              <span className="showcase__tip-target">A longer one</span>
            </Tooltip>
          </Specimen>
        </Specimens>
      </Part>
    </>
  );
}
