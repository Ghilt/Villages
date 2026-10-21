import { useState } from 'react';

import { ReplayBar } from '../../ui/replay/Replay';
import { TugChart } from '../../ui/replay/TugChart';
import { useReplayClock } from '../../ui/replay/useReplayClock';
import { Slider } from '../../ui/slider/Slider';
import { HappeningPlate, TugBar } from '../../ui/tug/Tug';
import { towardSaid } from '../../ui/tug/tugShare';
import {
  AUTHORITY,
  BANDS,
  BRANNOCK_SIDE,
  HOLY,
  INDUSTRY,
  TICKS,
  TUG,
  VARGA_SIDE,
  VIOLENCE,
} from './challengeSamples';
import { Part, Specimen, Specimens } from './Specimen';

/** A replay held here, its clock the library's own. */
function LiveReplay({ start = 26 }: { start?: number }) {
  const clock = useReplayClock(60, start);
  return (
    <ReplayBar
      second={clock.second}
      last={60}
      playing={clock.playing}
      pace={clock.pace}
      onPlay={clock.play}
      onPause={clock.pause}
      onQuicken={clock.quicken}
      onShow={clock.show}
      bands={BANDS}
      tug={TUG}
      ticks={TICKS}
    />
  );
}

/** The tug held here, dragged by a slider under it. */
function LiveTug() {
  const [tug, setTug] = useState(28.3);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 'min(560px, 100%)' }}>
      <TugBar
        first={VARGA_SIDE}
        second={BRANNOCK_SIDE}
        tug={tug}
        said={towardSaid(tug, 'Varga', 'Brannock')}
      />
      <Slider value={tug} min={-100} max={100} step={0.5} onChange={setTug} label="The tug" />
    </div>
  );
}

/** What a challenge's stage says over and under it: the tug, the happening, the replay. */
export function ChallengeReadouts() {
  return (
    <>
      <Part title="The tug">
        <p className="ui-label showcase__lead">
          The tug as a share of the bar, the first house’s colour from the left as far as its share: at 28
          toward Varga, Varga has 64 parts in a hundred. So it moves as the crowd or the ground it stands over
          does, and what it says rides the split. Drag the live one.
        </p>
        <Specimens>
          <Specimen name="TugBar tug={0}" note="even">
            <TugBar first={VARGA_SIDE} second={BRANNOCK_SIDE} tug={0} said="even" />
          </Specimen>
          <Specimen name="TugBar tug={28.3}" note="leaning toward the first">
            <TugBar first={VARGA_SIDE} second={BRANNOCK_SIDE} tug={28.3} said="28.3 toward Varga" />
          </Specimen>
          <Specimen name="TugBar tug={100}" note="pulled to the first’s end">
            <TugBar first={VARGA_SIDE} second={BRANNOCK_SIDE} tug={100} said="100 toward Varga" />
          </Specimen>
          <Specimen name="TugBar tug={-100}" note="pulled to the second’s end">
            <TugBar first={VARGA_SIDE} second={BRANNOCK_SIDE} tug={-100} said="100 toward Brannock" />
          </Specimen>
          <Specimen name="TugBar, live" note="held here: drag the slider under it" wide>
            <LiveTug />
          </Specimen>
        </Specimens>
      </Part>

      <Part title="The happening">
        <p className="ui-label showcase__lead">
          The happening going on, over the stage: its aspects’ discs, its name, the seconds it runs, and whom
          it lights.
        </p>
        <Specimens>
          <Specimen name="HappeningPlate" note="one aspect" wide>
            <HappeningPlate
              aspects={[HOLY]}
              name="Holy"
              when="second 15 to 30"
              said="Varga’s Holy matches, ×1.5 · Brannock’s Reason answers its anti-aspect"
            />
          </Specimen>
          <Specimen name="HappeningPlate, two aspects" note="a happening of two, each lighting a house" wide>
            <HappeningPlate
              aspects={[VIOLENCE, INDUSTRY]}
              name="Violence and Industry"
              when="second 45 to 60"
              said="Varga’s Violence matches, ×1.5 · Brannock’s Industry matches, ×1.5"
            />
          </Specimen>
          <Specimen name="HappeningPlate, nobody lit" note="a happening no slice matches" wide>
            <HappeningPlate
              aspects={[AUTHORITY]}
              name="Authority"
              when="second 0 to 20"
              said="nothing matches"
            />
          </Specimen>
        </Specimens>
      </Part>

      <Part title="The replay">
        <p className="ui-label showcase__lead">
          Play and pause, the pace and to the end, every one a mark; the happenings as bands with the tug
          drawn over them, the first side’s end at the top; a gilt tick where something arrived and a velvet
          one where it fell; and the scrub, which the arrow keys step a second at a time. The live one plays
          sixty seconds of a sermon.
        </p>
        <Specimens>
          <Specimen name="ReplayBar" note="held here by useReplayClock: play it, quicken it, scrub it" wide>
            <LiveReplay />
          </Specimen>
          <Specimen name="ReplayBar, at the end" note="to the end is spent; play starts it again" wide>
            <ReplayBar
              second={60}
              last={60}
              playing={false}
              pace={2}
              onPlay={() => {}}
              onPause={() => {}}
              onQuicken={() => {}}
              onShow={() => {}}
              bands={BANDS}
              tug={TUG}
              ticks={TICKS}
            />
          </Specimen>
          <Specimen
            name="TugChart"
            note="the tug second by second, as the history opens with it, second 26 marked"
            wide
          >
            <div style={{ width: 'min(420px, 100%)' }}>
              <TugChart tug={TUG} second={26} first={VARGA_SIDE} other={BRANNOCK_SIDE} />
            </div>
          </Specimen>
          <Specimen name="ReplayBar, narrow" note="the track gives way, the marks keep their size" wide>
            <div style={{ width: 380, maxWidth: '100%' }}>
              <LiveReplay start={0} />
            </div>
          </Specimen>
        </Specimens>
      </Part>
    </>
  );
}
