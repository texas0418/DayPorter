// src/SettingsContext.tsx
// App settings: the bid calculator's default numbers (every cleaning company
// has its own loaded labor rate and production speed — set once, every bid
// starts from them). Persisted via expo-sqlite/kv-store (same API as
// AsyncStorage, but backed by SQLite we already ship).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import Storage from 'expo-sqlite/kv-store';

const KEY = 'dayporter.settings.v1';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  laborRateCents: number; // loaded hourly cost of one cleaner
  prodRateSqftHr: number; // sqft cleaned per labor hour
  suppliesPct: number; // supplies as % of labor
  marginPct: number; // profit as % of price
  themeMode: ThemeMode; // resolved by useTheme(); 'system' follows the OS
}

const DEFAULTS: Settings = {
  laborRateCents: 2000, // $20/hr loaded
  prodRateSqftHr: 3000, // typical office production rate
  suppliesPct: 6,
  marginPct: 30,
  themeMode: 'system',
};

interface Ctx {
  settings: Settings;
  loaded: boolean;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<Ctx>({
  settings: DEFAULTS,
  loaded: false,
  update: () => {},
});

export function SettingsProvider(props: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Storage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Settings>;
          setSettings({ ...DEFAULTS, ...parsed });
        }
      })
      .catch((e) => console.warn('settings load failed', e))
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      Storage.setItem(KEY, JSON.stringify(next)).catch((e) =>
        console.warn('settings save failed', e),
      );
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loaded, update }}>
      {props.children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
