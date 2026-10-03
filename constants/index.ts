export const THEMES = {
  luxury: {
    black: '#0A0A0F',
    darkSurface: '#12121A',
    card: '#1C1C28',
    cardAlt: '#22222E',
    gold: '#50C878', // Emerald Green
    goldLight: '#8CE3A7',
    goldDark: '#2E8C4A',
    green: '#1DB954',
    textPrimary: '#FFFFFF',
    textSecondary: '#B3B3C8',
    textTertiary: '#6B6B80',
    divider: '#2A2A38',
    error: '#FF5252',
    white: '#FFFFFF',
    success: '#1DB954',
    transparent: 'transparent',
  },
  love: {
    black: '#140A0D',
    darkSurface: '#1C0E13',
    card: '#29141B',
    cardAlt: '#361A24',
    gold: '#FF3366', // Vibrant Pink/Red
    goldLight: '#FF668D',
    goldDark: '#CC003D',
    green: '#1DB954',
    textPrimary: '#FFFFFF',
    textSecondary: '#D9B3C0',
    textTertiary: '#997A85',
    divider: '#401C27',
    error: '#FF5252',
    white: '#FFFFFF',
    success: '#1DB954',
    transparent: 'transparent',
  },
  ocean: {
    black: '#050A14',
    darkSurface: '#08101F',
    card: '#0D1A33',
    cardAlt: '#122447',
    gold: '#00E5FF', // Cyan
    goldLight: '#66EFFF',
    goldDark: '#00B3CC',
    green: '#1DB954',
    textPrimary: '#FFFFFF',
    textSecondary: '#B3CDE6',
    textTertiary: '#6B8EAD',
    divider: '#1A3366',
    error: '#FF5252',
    white: '#FFFFFF',
    success: '#1DB954',
    transparent: 'transparent',
  },
  cyberpunk: {
    black: '#090514',
    darkSurface: '#120A2B',
    card: '#1F1147',
    cardAlt: '#2C1863',
    gold: '#FF00FF', // Neon Magenta
    goldLight: '#FF66FF',
    goldDark: '#B300B3',
    green: '#00FFCC', // Cyan accent
    textPrimary: '#FFFFFF',
    textSecondary: '#D1B3FF',
    textTertiary: '#A366FF',
    divider: '#3A1F80',
    error: '#FF3366',
    white: '#FFFFFF',
    success: '#00FFCC',
    transparent: 'transparent',
  },
  forest: {
    black: '#0A120D',
    darkSurface: '#0E1A13',
    card: '#142B1D',
    cardAlt: '#1A3D28',
    gold: '#4CAF50', // Leaf Green
    goldLight: '#81C784',
    goldDark: '#388E3C',
    green: '#2E7D32',
    textPrimary: '#FFFFFF',
    textSecondary: '#A5D6A7',
    textTertiary: '#66BB6A',
    divider: '#1B4D2A',
    error: '#FF5252',
    white: '#FFFFFF',
    success: '#4CAF50',
    transparent: 'transparent',
  },
  spotify: {
    black: '#000000',
    darkSurface: '#121212',
    card: '#181818',
    cardAlt: '#282828',
    gold: '#1DB954', // Main Spotify Green accent
    goldLight: '#1ED760',
    goldDark: '#1AA34A',
    green: '#1DB954',
    textPrimary: '#FFFFFF',
    textSecondary: '#B3B3B3',
    textTertiary: '#7F7F7F',
    divider: '#282828',
    error: '#E91429',
    white: '#FFFFFF',
    success: '#1DB954',
    transparent: 'transparent',
  }
};

export const COLORS = THEMES.luxury;

export const GENRES = [
  { name: 'Bongo Flava', icon: 'mic', color: '#E91E63', emoji: '🇹🇿' },
  { name: 'Amapiano',    icon: 'musical-notes', color: '#8E2DE2', emoji: '🎹' },
  { name: 'Chill Vibes', icon: 'cafe', color: '#2193b0', emoji: '☕' },
  { name: 'Emotion',     icon: 'heart-half', color: '#0f0c29', emoji: '💔' },
  { name: 'Taarab',      icon: 'musical-notes', color: '#9C27B0', emoji: '🎻' },
  { name: 'Singeli',     icon: 'flash', color: '#3F51B5', emoji: '⚡' },
  { name: 'Dansi',       icon: 'people', color: '#009688', emoji: '💃' },
  { name: 'Gospel / Injili', icon: 'heart', color: '#FF5722', emoji: '🙌' },
  { name: 'Afrobeats',   icon: 'earth', color: '#795548', emoji: '🌍' },
  { name: 'Hip-hop',     icon: 'headset', color: '#607D8B', emoji: '🎤' },
  { name: 'R&B',         icon: 'musical-note', color: '#4CAF50', emoji: '🎵' },
  { name: 'Reggae',      icon: 'leaf', color: '#FF9800', emoji: '🌿' },
  { name: 'Traditional', icon: 'radio', color: '#00BCD4', emoji: '🥁' },
];

export type Track = {
  id: string;
  user_id: string;
  title: string;
  artist_name: string;
  genre: string;
  cover_url: string | null;
  audio_url: string;
  duration_sec: number;
  play_count: number;
  like_count: number;
  comment_count?: number;
  description: string | null;
  is_public: boolean;
  lyrics?: string;
  is_ai?: boolean;
  lyrics_swahili?: string | null;
  lyrics_english?: string | null;
  parent_beat_id?: string;
  created_at: string;
  profile?: Profile;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  role: 'artist' | 'fan';
  is_verified: boolean;
  follower_count: number;
  following_count: number;
  track_count: number;
  credits: number;
  lyrics_used: number;   // how many AI lyrics generations used so far
  partner_id?: string;
  is_admin?: boolean;
};

export type Comment = {
  id: string;
  track_id: string;
  user_id: string;
  content: string;
  timestamp_sec: number;
  created_at: string;
  profile?: Profile;
};
