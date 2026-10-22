import { ChallengeDiorama } from './ChallengeDiorama';
import { ChallengeDrawer } from './ChallengeDrawer';
import { ChallengeFigures } from './ChallengeFigures';
import { ChallengeLightning } from './ChallengeLightning';
import { ChallengeReadouts } from './ChallengeReadouts';
import { ChallengeSeals } from './ChallengeSeals';
import { ChallengeSlices } from './ChallengeSlices';
import { ChallengeTravel } from './ChallengeTravel';

/** The parts a challenge's spectacle is built from, each in its states. Decision record 0116. */
export function Challenges() {
  return (
    <>
      <ChallengeSlices />
      <ChallengeReadouts />
      <ChallengeSeals />
      <ChallengeTravel />
      <ChallengeLightning />
      <ChallengeFigures />
      <ChallengeDiorama />
      <ChallengeDrawer />
    </>
  );
}
