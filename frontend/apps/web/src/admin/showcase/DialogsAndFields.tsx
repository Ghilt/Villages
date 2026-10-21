import { useCallback, useRef, useState } from 'react';

import { usePictures } from '../../ui/art/pictures';
import { TextButton } from '../../ui/button/Button';
import { Dialog, DialogBox } from '../../ui/dialog/Dialog';
import { Dropdown } from '../../ui/field/Dropdown';
import type { DropdownOption } from '../../ui/field/Dropdown';
import { TextField } from '../../ui/field/TextField';
import { HoldButton } from '../../ui/hold/HoldButton';
import { Medallion } from '../../ui/medallion/Medallion';
import { Toasts } from '../../ui/toast/Toasts';
import { DialogInARoom } from './DialogInARoom';
import type { Toast } from '../../ui/toast/Toasts';
import { FIGURES, Portrait } from './sampleFigures';
import { Part, Specimen, Specimens } from './Specimen';

/** Things that happen, one after another, each time the page is asked for one. */
const HAPPENINGS: readonly Omit<Toast, 'id'>[] = [
  { title: 'Sister Agathe joined the house', text: 'She is the second of its key figures.', mark: 'piety' },
  {
    title: 'The Reformation spreads',
    text: 'New doctrines challenge the Church in the capital.',
    mark: 'reason',
  },
  { title: 'A letter from Vienna', mark: 'influence' },
  {
    title: 'Paris grew',
    text: 'It holds 3,245 souls, and on Thursdays the market fills the square before the abbey.',
    mark: 'domain',
  },
];

/** A toast that stays until it is put away, to be looked at. */
const STAYING: readonly Toast[] = [
  {
    id: 'staying',
    title: 'Lyon is short of grain',
    text: 'It stays until it is put away.',
    mark: 'wealth',
    stays: true,
  },
];

/** A letter too long for the dialog it is read in, so that its words scroll. */
const LETTER = [
  'To the house of Montreuil, from the court at Vienna, by the hand of its secretary.',
  'The court has heard of the mill on the river and of the market that fills the square on Thursdays, and it is glad of both.',
  'It asks after the health of the house, and after its debts, which are spoken of in the antechambers more than the house might like.',
  'It asks, too, whether the house would send a son or a daughter to be educated at the court, as a pledge of its friendship.',
  'An answer is expected before the snows close the passes.',
];

/** The house's seats, one of which is picked; one not yet founded, so not to be picked. */
const SEATS: readonly DropdownOption[] = [
  { id: 'paris', label: 'Paris' },
  { id: 'lyon', label: 'Lyon' },
  { id: 'montreuil', label: 'Montreuil' },
  { id: 'saint-germain', label: 'Saint-Germain-des-Prés' },
  { id: 'vienna', label: 'Vienna, not yet founded', disabled: true },
];

/** What is wrong with a house's name, or nothing when nothing is. */
function problemOf(name: string): string | undefined {
  const given = name.trim();
  if (given.length === 1) {
    return 'A name needs at least two letters.';
  }
  return /[0-9]/.test(given) ? 'A name has no figures in it.' : undefined;
}

const KILL = {
  title: 'Kill Count Henri de Montreuil?',
  said: 'He will be gone from the house for good, and whatever he held goes with him. This cannot be undone.',
};

export function DialogsAndFields() {
  const { list, problem } = usePictures();
  const [asking, setAsking] = useState(false);
  const [reading, setReading] = useState(false);
  const [answer, setAnswer] = useState('nothing asked yet');
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const [name, setName] = useState('');
  const [sought, setSought] = useState('');
  const [searched, setSearched] = useState<string | null>(null);
  const [seat, setSeat] = useState('montreuil');
  const told = useRef(0);
  const gone = useCallback((id: string) => setToasts((was) => was.filter((one) => one.id !== id)), []);
  if (list === null) {
    return <p className="showcase__to-come">{problem ?? 'Reading the pictures…'}</p>;
  }
  const happen = () => {
    const next = HAPPENINGS[told.current % HAPPENINGS.length]!;
    told.current += 1;
    setToasts((was) => [...was, { ...next, id: `told-${told.current}` }]);
  };
  const answered = (said: string) => {
    setAsking(false);
    setAnswer(said);
  };
  return (
    <>
      <Part title="Dialogs">
        <p className="ui-label showcase__lead">
          A question that has to be answered before anything else, over the whole page and the page dimmed
          behind it. Escape, the close mark or a press on the dimmed page puts it away unanswered.{' '}
          <span className="showcase__said">{answer}</span>
        </p>
        <Specimens>
          <Specimen name="Dialog" note={['killing a key figure, held to confirm', 'press to ask it']}>
            <TextButton onClick={() => setAsking(true)}>Kill the Count…</TextButton>
            <Dialog
              open={asking}
              onClose={() => answered('put away, nobody killed')}
              title={KILL.title}
              actions={
                <>
                  <TextButton face="secondary" onClick={() => answered('spared')}>
                    Spare him
                  </TextButton>
                  <HoldButton onConfirm={() => answered('killed')}>Kill</HoldButton>
                </>
              }
            >
              <p className="ui-body">{KILL.said}</p>
            </Dialog>
          </Specimen>
          <Specimen name="Dialog" note={['a letter, longer than the window', 'its words scroll inside it']}>
            <TextButton face="secondary" onClick={() => setReading(true)}>
              Read the letter…
            </TextButton>
            <Dialog
              open={reading}
              onClose={() => setReading(false)}
              title="A letter from Vienna"
              actions={<TextButton onClick={() => setReading(false)}>Put it down</TextButton>}
            >
              {LETTER.map((said) => (
                <p key={said} className="ui-body">
                  {said}
                </p>
              ))}
            </Dialog>
          </Specimen>
          <Specimen
            name="DialogRoom"
            note={['a dialog over a room the size of a phone', 'the page round it in reach']}
            wide
          >
            <DialogInARoom dismissable />
          </Specimen>
          <Specimen
            name="DialogRoom"
            note={['one nothing puts away but an answer', 'as the signed-out screen']}
            wide
          >
            <DialogInARoom dismissable={false} />
          </Specimen>
          <Specimen name="DialogBox" note="its frame alone, standing still" wide>
            <div className="showcase__dialog-width">
              <DialogBox
                title={KILL.title}
                onClose={() => undefined}
                actions={
                  <>
                    <TextButton face="secondary">Spare him</TextButton>
                    <HoldButton onConfirm={() => undefined}>Kill</HoldButton>
                  </>
                }
              >
                <p className="ui-body">{KILL.said}</p>
              </DialogBox>
            </div>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Toasts">
        <p className="ui-label showcase__lead">
          Something happened, said in a corner and gone once it has been read: longer for more words, and
          never while the pointer or the keyboard is on it.{' '}
          <span className="showcase__said">
            {toasts.length === 0 ? 'nothing to say' : `${toasts.length} showing`}
          </span>
        </p>
        <Specimens>
          <Specimen
            name="Toasts"
            note={['in the corner of whatever holds them', 'point at one to keep it']}
            wide
          >
            <div className="showcase__toast-room">
              <TextButton onClick={happen}>Something happens</TextButton>
              <Toasts items={toasts} onGone={gone} />
            </div>
          </Specimen>
          <Specimen name={'Toasts place="flow"'} note="one that stays until it is put away">
            <Toasts items={STAYING} onGone={() => undefined} place="flow" />
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Text fields">
        <p className="ui-label showcase__lead">
          Words typed on parchment in a gilt rim, its name over it and a line under it: how it is to be
          filled, or what is wrong with what is in it. A search has its mark at its end, and Enter searches
          too.{' '}
          <span className="showcase__said">
            {name === '' ? 'no name yet' : `named ${name}`}
            {searched === null ? '' : `; searched for ${searched === '' ? 'nothing' : searched}`}
          </span>
        </p>
        <Specimens>
          <Specimen name="TextField" note={['the house’s name', 'one letter, or a figure, is wrong']} wide>
            <div className="showcase__field-width">
              <TextField
                label="The house’s name"
                value={name}
                onChange={setName}
                placeholder="Enter a name…"
                hint="As it will be known across the world."
                problem={problemOf(name)}
                maxLength={40}
              />
            </div>
          </Specimen>
          <Specimen name="TextField onSearch" note="a search: its mark, or Enter" wide>
            <div className="showcase__field-width">
              <TextField
                label="Search the gazetteer"
                hideLabel
                value={sought}
                onChange={setSought}
                placeholder="A place, a house, a name…"
                onSearch={setSearched}
              />
            </div>
          </Specimen>
          {(
            [
              ['empty', '', {}],
              ['filled', 'Montreuil', {}],
              ['hovered', 'Montreuil', { showing: 'hover' }],
              ['focused', 'Montreuil', { showing: 'focus' }],
              ['wrong', 'M', { problem: 'A name needs at least two letters.' }],
              ['disabled', 'Montreuil', { disabled: true }],
            ] as const
          ).map(([state, value, props]) => (
            <Specimen key={state} name="TextField" note={state}>
              <div className="showcase__field-small">
                <TextField
                  label="The house’s name"
                  value={value}
                  onChange={() => undefined}
                  placeholder="Enter a name…"
                  {...props}
                />
              </div>
            </Specimen>
          ))}
          <Specimen name={'TextField size="small"'} note="as tall as a small button">
            <div className="showcase__field-small">
              <TextField
                label="A motto"
                value=""
                onChange={() => undefined}
                placeholder="Reason above all"
                size="small"
              />
            </div>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Dropdowns">
        <p className="ui-label showcase__lead">
          One of many picked: the one picked on the parchment, the rest opening under it. The browser&rsquo;s
          own list is under the painting, so a phone opens its own picker and typing a letter picks.{' '}
          <span className="showcase__said">seat: {SEATS.find((one) => one.id === seat)?.label}</span>
        </p>
        <Specimens>
          <Specimen name="Dropdown" note={['the house’s seat', 'one not yet founded cannot be picked']} wide>
            <div className="showcase__field-width">
              <Dropdown
                label="The house’s seat"
                options={SEATS}
                chosen={seat}
                onChoose={setSeat}
                hint="Where its court sits."
              />
            </div>
          </Specimen>
          {(
            [
              ['at rest', {}],
              ['hovered', { showing: 'hover' }],
              ['focused', { showing: 'focus' }],
              ['disabled', { disabled: true }],
            ] as const
          ).map(([state, props]) => (
            <Specimen key={state} name="Dropdown" note={state}>
              <div className="showcase__field-small">
                <Dropdown
                  label="The house’s seat"
                  options={SEATS}
                  chosen="paris"
                  onChoose={() => undefined}
                  {...props}
                />
              </div>
            </Specimen>
          ))}
          <Specimen name={'Dropdown size="small"'} note="as tall as a small button">
            <div className="showcase__field-small">
              <Dropdown
                label="The house’s seat"
                options={SEATS}
                chosen="lyon"
                onChoose={() => undefined}
                size="small"
              />
            </div>
          </Specimen>
        </Specimens>
      </Part>

      <Part title="Medallions">
        <p className="ui-label showcase__lead">
          A round or oval frame, one picture never sliced. Where it is clear inside, it is a window, and a
          portrait shows through it; painted whole, it is an emblem. The oval is the moodboard&rsquo;s, its
          own portrait cut out to leave the window; the portraits are the game&rsquo;s.
        </p>
        <Specimens>
          {FIGURES.slice(0, 3).map((figure, at) => (
            <Specimen key={figure.portrait} name={`Medallion size={${[72, 96, 128][at]}}`} note={figure.full}>
              <Medallion
                name="portrait-oval"
                size={[72, 96, 128][at]}
                picture={<Portrait figure={figure} />}
                label={figure.full}
              />
            </Specimen>
          ))}
          <Specimen name="Medallion" note="its window empty: dark glass">
            <Medallion name="portrait-oval" size={96} />
          </Specimen>
          {(
            [
              ['compass', 'the compass, the way to everything not on the screen'],
              ['shield', 'a house’s shield'],
              ['sigil', 'a house’s sigil'],
            ] as const
          ).map(([name, note]) => (
            <Specimen key={name} name={`Medallion name="${name}"`} note={['an emblem, painted whole', note]}>
              <Medallion name={name} size={96} label={note} />
            </Specimen>
          ))}
        </Specimens>
      </Part>
    </>
  );
}
