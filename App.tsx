import { useEffect, useState } from 'react';
import PipelineScreen from './src/screens/PipelineScreen';
import ClientScreen from './src/screens/ClientScreen';
import BidScreen from './src/screens/BidScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { SettingsProvider } from './src/SettingsContext';
import { initPurchases } from './src/proAccess';

type Screen =
  | { name: 'pipeline' }
  | { name: 'client'; clientId: number }
  | { name: 'bid'; clientId: number | null }
  | { name: 'settings' };

function Root() {
  const [screen, setScreen] = useState<Screen>({ name: 'pipeline' });

  if (screen.name === 'client')
    return (
      <ClientScreen
        clientId={screen.clientId}
        onBack={() => setScreen({ name: 'pipeline' })}
        onNewBid={(clientId) => setScreen({ name: 'bid', clientId })}
      />
    );
  if (screen.name === 'bid')
    return (
      <BidScreen
        clientId={screen.clientId}
        onBack={() =>
          setScreen(
            screen.clientId == null
              ? { name: 'pipeline' }
              : { name: 'client', clientId: screen.clientId },
          )
        }
      />
    );
  if (screen.name === 'settings')
    return <SettingsScreen onBack={() => setScreen({ name: 'pipeline' })} />;
  return (
    <PipelineScreen
      onOpenClient={(clientId) => setScreen({ name: 'client', clientId })}
      onCalculator={() => setScreen({ name: 'bid', clientId: null })}
      onSettings={() => setScreen({ name: 'settings' })}
    />
  );
}

export default function App() {
  useEffect(() => {
    // Fail-open: unlocks Pro immediately in Expo Go / placeholder builds.
    initPurchases();
  }, []);
  return (
    <SettingsProvider>
      <Root />
    </SettingsProvider>
  );
}
