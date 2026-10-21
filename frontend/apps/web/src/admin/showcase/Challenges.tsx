import { ChallengeDiorama } from './ChallengeDiorama';
import { ChallengeFigures } from './ChallengeFigures';
import { ChallengeReadouts } from './ChallengeReadouts';
import { ChallengeSlices } from './ChallengeSlices';

/** The parts a challenge's spectacle is built from, each in its states. Decision record 0116. */
export function Challenges() {
  return (
    <>
      <ChallengeSlices />
      <ChallengeReadouts />
      <ChallengeFigures />
      <ChallengeDiorama />
    </>
  );
}
