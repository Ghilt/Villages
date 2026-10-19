import { useStore } from '../store/useStore';
import { LoadingScreen } from '../ui/loadingScreen/LoadingScreen';
import { startupStore } from './startup';

/** The loading screen over the game while the game starts up, from its first frame until the map is drawn. */
export function StartupScreen() {
  const { lifted, share, shareSaid } = useStore(startupStore);
  return (
    <LoadingScreen
      title="Villages"
      says="The map is being painted"
      lifted={lifted}
      {...(share === undefined ? {} : { share })}
      {...(shareSaid === undefined ? {} : { shareSaid })}
    />
  );
}
