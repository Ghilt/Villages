import './challenges.css';

import { useEffect, useRef, useState } from 'react';

import { canAct } from '@villages/client-core';
import { ASPECTS } from '@villages/world';
import type { ChallengeRowView, ChallengeRunFrame } from '@villages/protocol';
import type { Aspect, Challenges as Content } from '@villages/world';

import { acceptChallenge, sessionStore, watchChallenge } from '../net/gateway';
import { useChallenges } from '../net/challenges';
import { aspectShown } from '../spectacle/said';
import { Spectacle } from '../spectacle/Spectacle';
import { Icon } from '../stage/Icons';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import type { Room } from '../stage/panes';
import { useStore } from '../store/useStore';
import { TextButton } from '../ui/button/Button';
import { List, ListRow } from '../ui/list/List';
import { Mark } from '../ui/mark/Mark';
import { SliceChip } from '../ui/slice/Slice';
import {
  bringing,
  effectsSaid,
  firstWaiting,
  foughtFor,
  historySaid,
  housesOf,
  MOST_BROUGHT,
  newestFirst,
  nextSaid,
  replaySaid,
  resultSaid,
  waitingAt,
} from './describe';
import type { ChallengeWaiting } from './describe';
import { challengeAskedStore, chosenFor } from './toChoose';
import type { ChallengeAsked } from './toChoose';

const isAspect = (name: string): name is Aspect => (ASPECTS as readonly string[]).includes(name);

/**
 * **Challenges**: the challenge a quest puts to the house, chosen for and accepted, in the column down the right edge
 * beside the dialogues and the quests. Pressing a quest's challenge node opens it on its choosing: who stands against
 * the house and the kind of challenge, and the house's starting slices to bring, up to three, the opponent's slices
 * not shown; *Accept challenge* fights it out, and the challenge is watched in its spectacle as it lands, held deep,
 * each side's slices seen only now; once played to its end, the result: who won, how, what each side gained and lost,
 * and where the quest goes on to, with the way back to it. Nothing is kept while choosing, so leaving it leaves nothing
 * behind. Otherwise it is the history: a challenge waiting first, pressed to choose for it, then every challenge the
 * house fought, newest first, each saying who stood against whom, the kind, who won and how, and where its quest went
 * on to, pressed to watch it again. See `MECHANICS.md`, Challenge, and decision record 0107, amended.
 */
export function Challenges({ room, toQuest }: { room: Room; toQuest: (questId: string) => void }) {
  const quests = useStore(sessionStore, (state) => state.yourQuests) ?? [];
  const fought = useStore(sessionStore, (state) => state.yourChallenges) ?? [];
  const content = useChallenges();
  // A challenge node pressed asks for its choosing; once opened, the asking is done.
  const askedNow = useStore(challengeAskedStore, (state) => state.asked);
  const [asked, setAsked] = useState<ChallengeAsked | null>(null);
  useEffect(() => {
    if (askedNow !== null) {
      setAsked(askedNow);
      chosenFor();
    }
  }, [askedNow]);
  // A challenge watched: asked for fought again, and played once it comes, its result after it.
  const [watching, setWatching] = useState<string | null>(null);
  const run = useStore(sessionStore, (state) => state.challengeRun);
  // Watched, the column opens out: the spectacle is drawn for more room than the column has at its normal size.
  const watch = (id: string) => {
    setWatching(id);
    watchChallenge(id);
    if (room.sizes.includes('full')) room.ask('full');
  };
  // Accepted, it is fought and the quest moves on in one decision; once it is in the history, it is watched.
  const [accepted, setAccepted] = useState<ChallengeAsked | null>(null);
  const newlyFought = foughtFor(fought, accepted);
  useEffect(() => {
    if (newlyFought !== null) {
      setAccepted(null);
      setAsked(null);
      watch(newlyFought.id);
    }
    // Watched once, as it first arrives in the history.
  }, [newlyFought?.id]);
  const waiting = waitingAt(quests, asked);
  const pending = firstWaiting(quests);
  const watched = fought.find((row) => row.id === watching) ?? null;

  if (room.size === 'strip') {
    return (
      <section className="challenges challenges--strip pane-strip" aria-label="Challenges">
        <span className="challenges__name">Challenges</span>
        <PaneSizeControl room={room} />
      </section>
    );
  }

  return (
    <section className={`challenges challenges--${room.size}`} aria-label="Challenges">
      <header className="challenges__head">
        {watched !== null && (
          <button
            type="button"
            className="challenges__back"
            aria-label="all challenges"
            title="all challenges"
            onClick={() => setWatching(null)}
          >
            <Icon name="list" />
          </button>
        )}
        <h2 className="challenges__name">{watched?.title ?? 'Challenges'}</h2>
        <PaneSizeControl room={room} />
      </header>
      <div className={`challenges__body${watched === null ? '' : ' challenges__body--watching'}`}>
        {watched !== null && content !== null ? (
          <Watching
            key={watched.id}
            row={watched}
            run={run?.id === watched.id ? run : null}
            content={content}
            toQuest={toQuest}
            toHistory={() => setWatching(null)}
          />
        ) : waiting !== null && content !== null ? (
          <Choosing
            key={`${waiting.quest.id}/${waiting.node.id}`}
            waiting={waiting}
            content={content}
            onAccepted={() => setAccepted({ questId: waiting.quest.id, nodeId: waiting.node.id })}
          />
        ) : (
          <>
            {pending !== null && (
              <List label="A challenge waiting">
                <ListRow
                  lead={<Mark name="challenge" size={20} />}
                  title={pending.node.title ?? 'A challenge'}
                  line={`Waits in ${pending.quest.title}: choose your slices`}
                  onPress={() => setAsked({ questId: pending.quest.id, nodeId: pending.node.id })}
                />
              </List>
            )}
            {fought.length === 0 ? (
              pending === null && <p className="challenges__none">No challenge has been fought yet.</p>
            ) : (
              <>
                <h3 className="challenges__group">Fought</h3>
                <List label="Challenges fought">
                  {newestFirst(fought).map((row) => (
                    <ListRow
                      key={row.id}
                      lead={<Mark name="challenge" size={20} />}
                      title={row.title}
                      line={historySaid(row)}
                      whole
                      label={`watch ${row.title} again`}
                      onPress={() => watch(row.id)}
                    />
                  ))}
                </List>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * A challenge watched: its spectacle, held deep, played from the start as the run comes, and once it has been played
 * or skipped to its end, the result under it - who won, how, what each side gained and lost, where the quest goes on
 * to - with the way back to the quest and to the history. A challenge the challenges in force can no longer fight is
 * not played, and says so, its result shown at once.
 */
function Watching({
  row,
  run,
  content,
  toQuest,
  toHistory,
}: {
  row: ChallengeRowView;
  run: ChallengeRunFrame | null;
  content: Content;
  toQuest: (questId: string) => void;
  toHistory: () => void;
}) {
  const [ended, setEnded] = useState(false);
  const written = useRef<HTMLElement>(null);
  // The result is written under the spectacle, and brought into sight as it is.
  useEffect(() => {
    if (ended) written.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [ended]);
  if (run === null) {
    return <p className="challenges__line challenges__waiting">The challenge is being fought…</p>;
  }
  const playable = run.moments.length > 0;
  const result = resultSaid(row);
  const next = nextSaid(row);
  const note = replaySaid(run);
  return (
    <div className="challenges__watching">
      {playable && (
        <div className="challenges__stage">
          <Spectacle
            run={run}
            sides={run.sides}
            content={content}
            houses={housesOf(row)}
            held="deep"
            onEnded={() => setEnded(true)}
          />
        </div>
      )}
      {note !== null && <p className="challenges__line challenges__note">{note}</p>}
      {(ended || !playable) && (
        <section ref={written} className="challenges__result" aria-label="The result">
          <h3 className="challenges__title">{result.won}</h3>
          <p className="challenges__line">{result.how}</p>
          {result.spoils.length > 0 && (
            <ul className="challenges__spoils">
              {result.spoils.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {next !== null && <p className="challenges__line challenges__next">{next}</p>}
          <div className="challenges__accept">
            <TextButton onClick={() => toQuest(row.questId)}>Back to the quest</TextButton>
            <TextButton onClick={toHistory}>All challenges</TextButton>
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * The choosing: the challenge's title, its kind in the catalogue's words and who stands against the house, and the
 * starting slices to bring, a chip each, pressed to bring it or leave it; *Accept challenge* once one is brought.
 */
function Choosing({
  waiting,
  content,
  onAccepted,
}: {
  waiting: ChallengeWaiting;
  content: Content;
  onAccepted: () => void;
}) {
  const { quest, node } = waiting;
  const [brought, setBrought] = useState<readonly string[]>([]);
  const acting = !useStore(sessionStore, canAct);
  const challenge = node.challenge!;
  const kind = content.kinds.find((one) => one.id === challenge.kind);
  const against = challenge.against.name;
  const accept = () => {
    acceptChallenge(
      quest.id,
      node.id,
      brought,
      `accepting "${node.title ?? 'the challenge'}" in "${quest.title}"`,
    );
    onAccepted();
  };
  return (
    <div className="challenges__choosing">
      <h3 className="challenges__title">{node.title ?? 'A challenge'}</h3>
      <p className="challenges__line">
        <span className="challenges__kind">{kind?.name ?? challenge.kind}</span> against{' '}
        <span className="challenges__against" style={{ borderColor: challenge.against.colour }}>
          {against}
        </span>
        {kind !== undefined && <span className="challenges__words"> {kind.words}</span>}
      </p>
      <p className="challenges__line">
        Bring up to {MOST_BROUGHT} of your slices. What {against} brings is not seen until it starts.
      </p>
      <div className="challenges__chips">
        {content.startingSlices.map((slice) =>
          isAspect(slice.aspect) ? (
            <SliceChip
              key={slice.id}
              aspect={aspectShown(slice.aspect)}
              state={brought.includes(slice.id) ? 'working' : 'idle'}
              said={effectsSaid(slice.effects, content)}
              chosen={brought.includes(slice.id)}
              disabled={!brought.includes(slice.id) && brought.length >= MOST_BROUGHT}
              onPress={() => setBrought(bringing(brought, slice.id))}
            />
          ) : null,
        )}
      </div>
      <div className="challenges__accept">
        <TextButton onClick={accept} disabled={brought.length === 0 || acting}>
          Accept challenge
        </TextButton>
      </div>
    </div>
  );
}
