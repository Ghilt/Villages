import './challenges.css';

import { useEffect, useState } from 'react';

import { canAct } from '@villages/client-core';
import { ASPECTS } from '@villages/world';
import type { Aspect, Challenges as Content } from '@villages/world';

import { acceptChallenge, sessionStore } from '../net/gateway';
import { useChallenges } from '../net/challenges';
import { aspectShown } from '../spectacle/said';
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
  historySaid,
  MOST_BROUGHT,
  newestFirst,
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
 * not shown; *Accept challenge* fights it out, and once the quest has moved on the column turns back to it. Nothing is
 * kept while choosing, so leaving it leaves nothing behind. Otherwise it is the history: a challenge waiting first,
 * pressed to choose for it, then every challenge the house fought, newest first, each saying who stood against whom,
 * the kind, who won and how, and where its quest went on to. See `MECHANICS.md`, Challenge, and decision record 0107,
 * amended.
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
  // Accepted, the quest moves on in the same decision; when it has, the column turns back to the quest.
  const [accepted, setAccepted] = useState<ChallengeAsked | null>(null);
  useEffect(() => {
    if (accepted !== null && waitingAt(quests, accepted) === null) {
      setAccepted(null);
      toQuest(accepted.questId);
    }
  }, [accepted, quests, toQuest]);
  const waiting = waitingAt(quests, asked);
  const pending = firstWaiting(quests);

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
        <h2 className="challenges__name">Challenges</h2>
        <PaneSizeControl room={room} />
      </header>
      <div className="challenges__body">
        {waiting !== null && content !== null ? (
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
