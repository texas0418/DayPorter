// src/theme.ts — DayPorter palettes: clean minimal UI in the house style with a
// steady "work uniform" navy accent. Pipeline stages carry the color coding
// (chip -> section header -> client card edge). Light and dark are both first-
// class; the switch lives in Settings (system / light / dark) and resolves
// through useTheme(). Screens build their StyleSheets from the palette via
// makeStyles(c) so nothing hardcodes a mode.

import { useColorScheme } from 'react-native';
import type { Stage } from './models';
import { useSettings } from './SettingsContext';

export type ThemeScheme = 'light' | 'dark';

export interface Palette {
  bg: string;
  card: string;
  cardBorder: string;
  hairline: string;
  textPrimary: string;
  textBody: string;
  textMuted: string;
  accent: string; // filled buttons, selected chips, links
  accentText: string; // text on accent fills
  danger: string;
  success: string;
  dueBg: string; // follow-ups-due banner
  dueBorder: string;
  dueText: string;
}

export const lightColors: Palette = {
  bg: '#f6f7f8',
  card: '#ffffff',
  cardBorder: '#e4e7ea',
  hairline: '#edeff1',
  textPrimary: '#16191d',
  textBody: '#3f454c',
  textMuted: '#868d95',
  accent: '#20486f',
  accentText: '#ffffff',
  danger: '#c93b3b',
  success: '#1d9e75',
  dueBg: '#fdf6ec',
  dueBorder: '#f0dfc2',
  dueText: '#633806',
};

export const darkColors: Palette = {
  bg: '#101317',
  card: '#1a1f25',
  cardBorder: '#2b323b',
  hairline: '#232a32',
  textPrimary: '#eef1f4',
  textBody: '#c3cad2',
  textMuted: '#7d8791',
  accent: '#7fa9d9', // navy reads as mud on dark; lift it
  accentText: '#0f1419',
  danger: '#e06c6c',
  success: '#4cc39a',
  dueBg: '#2b2210',
  dueBorder: '#48391a',
  dueText: '#e3b46b',
};

export interface StageColor {
  main: string; // dots, card edge
  bg: string; // chip background
  text: string; // text on bg
}

const stageColorsLight: Record<Stage, StageColor> = {
  lead: { main: '#868d95', bg: '#eef0f2', text: '#4a5058' },
  walkthrough: { main: '#378add', bg: '#e6f1fb', text: '#0c447c' },
  bid: { main: '#ba7517', bg: '#faeeda', text: '#633806' },
  active: { main: '#1d9e75', bg: '#e1f5ee', text: '#085041' },
  lost: { main: '#c93b3b', bg: '#faeaea', text: '#6e1c1c' },
};

const stageColorsDark: Record<Stage, StageColor> = {
  lead: { main: '#8b939c', bg: '#262c33', text: '#aeb6bf' },
  walkthrough: { main: '#4f97e3', bg: '#16293e', text: '#9cc4ef' },
  bid: { main: '#cf8b2b', bg: '#33270f', text: '#e3b46b' },
  active: { main: '#2cb185', bg: '#103028', text: '#6fd3ae' },
  lost: { main: '#d65454', bg: '#351717', text: '#e39a9a' },
};

export interface Theme {
  scheme: ThemeScheme;
  colors: Palette;
  stage: (s: Stage) => StageColor;
  /** For expo StatusBar: the text color, i.e. the opposite of the scheme. */
  statusBarStyle: 'light' | 'dark';
}

export function useTheme(): Theme {
  const system = useColorScheme();
  const { settings } = useSettings();
  const scheme: ThemeScheme =
    settings.themeMode === 'system'
      ? system === 'dark'
        ? 'dark'
        : 'light'
      : settings.themeMode;
  const stages = scheme === 'dark' ? stageColorsDark : stageColorsLight;
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    stage: (s) => stages[s],
    statusBarStyle: scheme === 'dark' ? 'light' : 'dark',
  };
}
