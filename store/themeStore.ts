import { create } from 'zustand';
import { THEMES } from '../constants';

export type ThemeType = keyof typeof THEMES;
export type VinylThemeType = 'classic' | 'scratched' | 'colored' | 'gold';

interface ThemeState {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  vinylTheme: VinylThemeType;
  setVinylTheme: (theme: VinylThemeType) => void;
  COLORS: typeof THEMES.spotify;
}

export const useThemeStore = create<ThemeState>()(
  (set) => ({
    theme: 'spotify',
    COLORS: THEMES.spotify,
    setTheme: (theme: ThemeType) => set({ theme, COLORS: THEMES[theme] }),
    vinylTheme: 'scratched',
    setVinylTheme: (vinylTheme: VinylThemeType) => set({ vinylTheme }),
  })
);
