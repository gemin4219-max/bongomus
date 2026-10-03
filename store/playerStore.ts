import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
// --- TEMPORARILY DISABLED FOR EXPO GO ---
// import TrackPlayer, { 
//   Event, 
//   State as TPState, 
//   AppKilledPlaybackBehavior, 
//   Capability, 
//   IOSCategory, 
//   IOSCategoryMode, 
//   IOSCategoryOptions, 
//   PitchAlgorithm 
// } from 'react-native-track-player';
let mainPlayer: AudioPlayer | null = null;

// Event bus for the Expo Go mock — lets the listeners at the bottom of this file
// (song ended → repeat/next, play counting, play/pause state) actually fire.
const _tpHandlers: Record<string, ((e: any) => void)[]> = {};
const emitTP = (event: string, payload: any) => {
  (_tpHandlers[event] || []).forEach(fn => { try { fn(payload); } catch (e) { console.warn('[player] listener error', e); } });
};
let mainStatusSub: { remove: () => void } | null = null;
let sawPlaying = false;

/** Only real http(s)/file URLs can be shown as lock-screen artwork. */
const toArtworkUrl = (a: any): string | undefined =>
  typeof a === 'string' && /^(https?|file):/.test(a) && !a.includes('via.placeholder') ? a : undefined;

/** Show title/artist/artwork + play/pause/scrub/±10s on the lock screen, Control Center and notification. */
const activateLockScreen = (player: AudioPlayer, t: any) => {
  try {
    player.setActiveForLockScreen(
      true,
      {
        title: t?.title || 'Bongo Stream',
        artist: t?.artist || 'Unknown Artist',
        albumTitle: 'Bongo Stream',
        artworkUrl: toArtworkUrl(t?.artwork),
      },
      { showSeekForward: true, showSeekBackward: true }
    );
  } catch (e) {
    console.warn('[player] lock screen controls failed', e);
  }
};

const releaseMainPlayer = () => {
  try { mainStatusSub?.remove(); } catch {}
  mainStatusSub = null;
  if (mainPlayer) {
    try { mainPlayer.pause(); } catch {}
    try { mainPlayer.setActiveForLockScreen(false); } catch {}
    try { mainPlayer.remove(); } catch {}
  }
  mainPlayer = null;
};

/** Mirror expo-audio's real status into the app (end of song, external pauses, progress). */
const attachStatusListener = (player: AudioPlayer) => {
  sawPlaying = false;
  const emitter = player as unknown as {
    addListener: (e: 'playbackStatusUpdate', cb: (s: { playing: boolean; isBuffering: boolean; didJustFinish: boolean; currentTime: number; duration: number }) => void) => { remove: () => void };
  };
  mainStatusSub = emitter.addListener('playbackStatusUpdate', (s) => {
    if (player !== mainPlayer) return; // stale player
    
    // expo-audio sometimes doesn't fire didJustFinish or gets stuck at the end with playing=true
    const isAtEnd = s.duration > 0 && s.currentTime >= s.duration - 0.3;

    if (s.didJustFinish || isAtEnd) {
      if (sawPlaying) {
        sawPlaying = false;
        try { player.pause(); } catch {}
        notifyPlaybackState(State.Paused);
        emitTP(Event.PlaybackQueueEnded, { position: s.currentTime });
      }
      return;
    }

    emitTP(Event.PlaybackProgressUpdated, { position: s.currentTime, duration: s.duration });
    if (s.playing) {
      if (!sawPlaying) { sawPlaying = true; notifyPlaybackState(State.Playing); }
    } else if (sawPlaying && !s.isBuffering) {
      sawPlaying = false;
      notifyPlaybackState(State.Paused);
    }
  });
};

// MOCK FOR EXPO GO:
const TrackPlayer: any = {
  setupPlayer: async () => {},
  updateOptions: async () => {},
  getQueue: async () => [],
  add: async (tracks: any[]) => {
    if (tracks && tracks.length > 0 && tracks[0].url) {
      releaseMainPlayer();
      try {
        mainPlayer = createAudioPlayer(tracks[0].url);
        attachStatusListener(mainPlayer);
        activateLockScreen(mainPlayer, tracks[0]);
      } catch (e) {
        console.error("Failed to create audio player:", e);
      }
    }
  },
  pause: async () => {
    if (mainPlayer) mainPlayer.pause();
    notifyPlaybackState(State.Paused);
  },
  play: async () => {
    if (mainPlayer) {
      // Pressing ▶ on a finished song restarts it instead of doing nothing.
      const d = mainPlayer.duration || 0;
      if (d > 0 && (mainPlayer.currentTime || 0) >= d - 0.3) {
        try { await mainPlayer.seekTo(0); } catch {}
      }
      mainPlayer.play();
    }
    notifyPlaybackState(State.Playing);
  },
  reset: async () => {
    releaseMainPlayer();
    notifyPlaybackState(State.None);
  },
  setRate: async () => {},
  getPlaybackState: async () => {
    if (mainPlayer && mainPlayer.playing) {
      return { state: TPState.Playing };
    }
    return { state: TPState.Paused };
  },
  seekTo: async (sec: number) => {
    // expo-audio's seekTo takes SECONDS
    if (mainPlayer) mainPlayer.seekTo(sec);
  },
  setVolume: async (vol: number) => {
    if (mainPlayer) mainPlayer.volume = vol;
  },
  getProgress: async () => {
    if (mainPlayer) {
      // expo-audio already reports currentTime / duration in SECONDS
      const position = mainPlayer.currentTime || 0;
      const duration = mainPlayer.duration || 0;
      return { position, duration: isFinite(duration) ? duration : 0, buffered: 0 };
    }
    return { position: 0, duration: 0, buffered: 0 };
  },
  addEventListener: (event: string, handler: (e: any) => void) => {
    (_tpHandlers[event] ||= []).push(handler);
    return { remove: () => { _tpHandlers[event] = (_tpHandlers[event] || []).filter(h => h !== handler); } };
  },
};
const Event: any = { PlaybackProgressUpdated: 'PlaybackProgressUpdated', PlaybackQueueEnded: 'PlaybackQueueEnded', PlaybackState: 'PlaybackState' };
const TPState: any = { Playing: 'playing', Paused: 'paused', Stopped: 'stopped', Buffering: 'buffering', Loading: 'loading', Error: 'error', Ready: 'ready', None: 'none' };
const AppKilledPlaybackBehavior: any = {};
const Capability: any = {};
const IOSCategory: any = {};
const IOSCategoryMode: any = {};
const IOSCategoryOptions: any = {};
const PitchAlgorithm: any = {};
// ---------------------------------------

import { Track } from '../constants';
import { useOfflineStore } from './offlineStore';
import { useAuthStore } from './authStore';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import * as React from 'react';
import { Alert } from 'react-native';
import { createAudioPlayer, AudioPlayer, setAudioModeAsync } from 'expo-audio';

let backgroundBeatPlayer: AudioPlayer | null = null;

export enum State {
  None = 'none',
  Ready = 'ready',
  Playing = 'playing',
  Paused = 'paused',
  Stopped = 'stopped',
  Buffering = 'buffering',
  Loading = 'loading',
  Error = 'error',
}

function mapTPState(state: TPState): State {
  switch (state) {
    case TPState.Playing: return State.Playing;
    case TPState.Paused: return State.Paused;
    case TPState.Stopped: return State.Stopped;
    case TPState.Buffering: return State.Buffering;
    case TPState.Loading: return State.Loading;
    case TPState.Error: return State.Error;
    case TPState.Ready: return State.Ready;
    case TPState.None: return State.None;
    default: return State.None;
  }
}

type ProgressState = { position: number; duration: number; buffered: number };
let _progressListeners: ((p: ProgressState) => void)[] = [];
function notifyProgress(p: ProgressState) {
  _progressListeners.forEach(fn => fn(p));
}

export function useProgress(): ProgressState {
  const [progress, setProgress] = React.useState<ProgressState>({ position: 0, duration: 0, buffered: 0 });
  React.useEffect(() => {
    const listener = (p: ProgressState) => setProgress(p);
    _progressListeners.push(listener);
    const interval = setInterval(async () => {
        try {
            const p = await TrackPlayer.getProgress();
            notifyProgress({ position: p.position, duration: p.duration, buffered: p.buffered });
        } catch(e) {}
    }, 500);
    return () => { 
        _progressListeners = _progressListeners.filter(fn => fn !== listener); 
        clearInterval(interval);
    };
  }, []);
  return progress;
}

type PlaybackStateHook = { state: State };
let _playbackListeners: ((s: PlaybackStateHook) => void)[] = [];
let _currentPlaybackState: State = State.None;

function notifyPlaybackState(state: State) {
  _currentPlaybackState = state;
  _playbackListeners.forEach(fn => fn({ state }));
  try { usePlayerStore.setState({ isPlaying: state === State.Playing }); } catch {}
}

export function usePlaybackState(): PlaybackStateHook {
  const [pbState, setPbState] = React.useState<PlaybackStateHook>({ state: _currentPlaybackState });
  React.useEffect(() => {
    const listener = (s: PlaybackStateHook) => setPbState(s);
    _playbackListeners.push(listener);
    return () => { _playbackListeners = _playbackListeners.filter(fn => fn !== listener); };
  }, []);
  return pbState;
}

export type PlayerMode = 'local' | 'listener' | 'host';

type PlayerStore = {
  currentTrack: Track | null;
  queue: Track[];
  isShuffled: boolean;
  repeatMode: 'off' | 'all' | 'one';
  playbackRate: number;
  sleepTimerMs: number | null;
  sleepTimerInterval: any | null;
  hasCountedPlay: boolean;
  isPlayerReady: boolean;
  mode: PlayerMode;
  liveStationId: string | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;

  initPlayer: () => Promise<void>;
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  pause: () => Promise<void>;
  pausePlayer: () => Promise<void>;
  closePlayer: () => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrev: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setSleepTimer: (minutes: number) => void;
  clearSleepTimer: () => void;
  markPlayCounted: () => void;
  cleanup: () => Promise<void>;
  setMode: (mode: PlayerMode, stationId?: string) => void;
  setVolume: (volume: number) => Promise<void>;
  addTrackToQueue: (track: Track) => void;
  removeTrackFromQueue: (index: number) => void;
  reorderQueue: (from: number, to: number) => void;
};

const getCdnUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.includes('gqxdbwnmnqvtdpxnrgtx.supabase.co')) {
    return url.replace('gqxdbwnmnqvtdpxnrgtx.supabase.co', 'bongo-cdn.meerkal70.workers.dev');
  }
  return url;
};



export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({

  currentTrack: null,
  queue: [],
  isShuffled: false,
  repeatMode: 'all',
  playbackRate: 1.0,
  sleepTimerMs: null,
  sleepTimerInterval: null,
  hasCountedPlay: false,
  isPlayerReady: false,
  mode: 'local',
  liveStationId: null,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,

  initPlayer: async () => {
    if (get().isPlayerReady) return;
    try {
      try {
        // Keep playing when the app is in the background / screen is locked,
        // ignore the silent switch, and own the lock-screen controls (requires doNotMix).
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
          allowsRecording: false,
        });
      } catch (e) {
        console.warn('[player] setAudioModeAsync failed', e);
      }

      await TrackPlayer.setupPlayer({
        iosCategory: IOSCategory.Playback,
        iosCategoryMode: IOSCategoryMode.Default,
        iosCategoryOptions: [IOSCategoryOptions.AllowBluetooth, IOSCategoryOptions.AllowBluetoothA2DP]
      });
      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.Stop,
          Capability.SeekTo
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious
        ],
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious
        ],
      });
      set({ isPlayerReady: true });

      // Bug 3 Fix: Restore last track into TrackPlayer (paused) so user can continue
      const persistedTrack = get().currentTrack;
      if (persistedTrack) {
        try {
          const decryptedUri = await useOfflineStore.getState().getDecryptedUri(persistedTrack.id);
          const offlineCoverUri = decryptedUri ? await useOfflineStore.getState().getOfflineCoverUri(persistedTrack.id) : null;
          let url = getCdnUrl(decryptedUri || persistedTrack.audio_url);
          if (url && typeof url === 'string') url = url.replace(/ /g, '%20');

          const tpTrack: any = {
            id: persistedTrack.id,
            url,
            title: persistedTrack.title,
            artist: persistedTrack.artist_name || 'Unknown Artist',
            duration: persistedTrack.duration_sec,
            pitchAlgorithm: PitchAlgorithm.Linear,
          };
          if (!decryptedUri && persistedTrack.cover_url) {
            tpTrack.artwork = getCdnUrl(persistedTrack.cover_url);
          } else if (offlineCoverUri) {
            tpTrack.artwork = 'file://' + offlineCoverUri.replace('file://', '');
          } else {
            tpTrack.artwork = require('../assets/icon.png');
          }

          const currentQueue = await TrackPlayer.getQueue();
          if (currentQueue.length === 0) {
            await TrackPlayer.add([tpTrack]);
            await TrackPlayer.pause();
          }
        } catch (restoreErr) {
          console.log('Failed to restore last track:', restoreErr);
        }
      }
    } catch (e) {
        console.log('TrackPlayer init error:', e);
        if (String(e).includes('already initialized')) {
          set({ isPlayerReady: true });
        }
      }
  },

  playTrack: async (track, queue = [track]) => {
    if (get().mode === 'listener' && !track.id.includes('force_sync')) {
      return;
    }
    
    if (!get().isPlayerReady) await get().initPlayer();
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    set({ currentTrack: track, queue, hasCountedPlay: false });
    notifyPlaybackState(State.Loading);
    
    // EXPO GO MOCK: Instantly trigger play count since we don't have real 30-second progress tracking right now
    get().markPlayCounted();

    if (get().mode === 'host' && get().liveStationId) {
      supabase.from('live_stations').update({
        current_track_id: track.id,
        started_at: new Date().toISOString()
      }).eq('id', get().liveStationId).then(({ error }) => {
        if (error) console.error("Failed to update live station track:", error.message);
      });
    }

    const decryptedUri = await useOfflineStore.getState().getDecryptedUri(track.id);
    const offlineCoverUri = decryptedUri ? await useOfflineStore.getState().getOfflineCoverUri(track.id) : null;
    let url = getCdnUrl(decryptedUri || track.audio_url);

    if (url && typeof url === 'string') {
        url = url.replace(/ /g, '%20');
    }

    const tpTrack: any = {
      id: track.id,
      url: url,
      title: track.title,
      artist: track.artist_name || 'Unknown Artist',
      duration: track.duration_sec,
      pitchAlgorithm: PitchAlgorithm.Linear,
    };

    // If we are playing a downloaded file, omit the remote artwork URL entirely to prevent crashes.
    // Instead, pass the downloaded local cover if available, or fallback to the bundled app icon!
    if (!decryptedUri && track.cover_url) {
      tpTrack.artwork = getCdnUrl(track.cover_url);
    } else if (offlineCoverUri) {
      tpTrack.artwork = 'file://' + offlineCoverUri.replace('file://', '');
    } else if (!decryptedUri) {
      tpTrack.artwork = 'https://via.placeholder.com/150';
    } else {
      tpTrack.artwork = require('../assets/icon.png');
    }

    try {
      await TrackPlayer.reset();

      if (backgroundBeatPlayer) {
        backgroundBeatPlayer.pause();
        backgroundBeatPlayer.remove();
        backgroundBeatPlayer = null;
      }

      if (track.parent_beat_id) {
        try {
          const { data: beatData } = await supabase.from('tracks').select('audio_url').eq('id', track.parent_beat_id).single();
          if (beatData?.audio_url) {
            const cdnBeatUrl = getCdnUrl(beatData.audio_url) || beatData.audio_url;
            backgroundBeatPlayer = createAudioPlayer(cdnBeatUrl);
            backgroundBeatPlayer.loop = true;
            backgroundBeatPlayer.play();
          }
        } catch (e) {
          console.warn('Failed to load parent beat audio', e);
        }
      }

      await TrackPlayer.add([tpTrack]);
      await TrackPlayer.setRate(get().playbackRate);
      await TrackPlayer.play();
    } catch (e) {
      console.log('TrackPlayer play error:', e);
      if (get().currentTrack?.id === track.id) {
        notifyPlaybackState(State.Error);
      }
    }
  },

  togglePlayPause: async () => {
    if (get().mode === 'listener') return;
    if (!get().isPlayerReady) {
      await get().initPlayer();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const state = (await TrackPlayer.getPlaybackState()).state;
    if (state === TPState.Playing) {
      await TrackPlayer.pause();
      if (backgroundBeatPlayer) backgroundBeatPlayer.pause();
    } else {
      await TrackPlayer.play();
      if (backgroundBeatPlayer) backgroundBeatPlayer.play();
    }
  },

  pause: async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const state = (await TrackPlayer.getPlaybackState()).state;
    if (state === TPState.Playing) {
      await TrackPlayer.pause();
      if (backgroundBeatPlayer) backgroundBeatPlayer.pause();
    }
  },

  pausePlayer: async () => {
    await get().pause();
  },

  skipNext: async () => {
    if (get().mode === 'listener') return;
    const { queue, currentTrack, isShuffled, playTrack } = get();
    if (!currentTrack || queue.length === 0) return;
    
    const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
    
    // Auto Play logic for when the queue ends
    if (!isShuffled && currentIdx === queue.length - 1) {
      if (get().repeatMode === 'all') {
        await playTrack(queue[0], queue);
        return;
      }
      try {
        const { data } = await supabase
          .from('tracks')
          .select('*, profile:profiles!tracks_user_id_fkey(*)')
          .eq('genre', currentTrack.genre || 'Bongo Flava')
          .neq('id', currentTrack.id)
          .eq('is_public', true)
          .limit(10);
        
        if (data && data.length > 0) {
          const nextTracks = data.sort(() => 0.5 - Math.random());
          const newQueue = [...queue, ...nextTracks];
          await playTrack(nextTracks[0], newQueue);
          return;
        }
      } catch (e) {
        console.error("Auto Play fetch error", e);
      }
      // Stop if no similar tracks found
      await TrackPlayer.pause();
      return;
    }

    const nextIdx = isShuffled
      ? Math.floor(Math.random() * queue.length)
      : (currentIdx + 1) % queue.length;
    await playTrack(queue[nextIdx], queue);
  },

  skipPrev: async () => {
    if (get().mode === 'listener') return;
    const { queue, currentTrack, playTrack } = get();
    if (!currentTrack) return;
    const position = await TrackPlayer.getProgress().then(p => p.position);
    if (position > 3) {
      await TrackPlayer.seekTo(0);
      return;
    }
    const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : queue.length - 1;
    await playTrack(queue[prevIdx], queue);
  },

  seekTo: async (ms: number) => {
    if (get().mode === 'listener') return;
    await TrackPlayer.seekTo(ms / 1000);
  },

  closePlayer: async () => {
    if (get().mode === 'listener') return;
    await TrackPlayer.pause();
    await TrackPlayer.reset();
    set({ currentTrack: null, queue: [] });
    notifyPlaybackState(State.None);
  },

  setPlaybackRate: async (rate: number) => {
    set({ playbackRate: rate });
    await TrackPlayer.setRate(rate);
  },

  toggleShuffle: () => {
    set(s => ({ isShuffled: !s.isShuffled }));
  },

  toggleRepeat: () => {
    set(s => {
      if (s.repeatMode === 'off') return { repeatMode: 'all' };
      if (s.repeatMode === 'all') return { repeatMode: 'one' };
      return { repeatMode: 'off' };
    });
  },

  setSleepTimer: (minutes: number) => {
    if (get().sleepTimerInterval) clearInterval(get().sleepTimerInterval);
    const ms = minutes * 60 * 1000;
    const interval = setInterval(async () => {
      const state = get();
      if (state.sleepTimerMs !== null) {
        if (state.sleepTimerMs <= 1000) {
          clearInterval(state.sleepTimerInterval);
          await TrackPlayer.pause();
          set({ sleepTimerMs: null, sleepTimerInterval: null });
        } else {
          set({ sleepTimerMs: state.sleepTimerMs - 1000 });
        }
      }
    }, 1000);
    set({ sleepTimerMs: ms, sleepTimerInterval: interval });
  },

  clearSleepTimer: () => {
    if (get().sleepTimerInterval) clearInterval(get().sleepTimerInterval);
    set({ sleepTimerMs: null, sleepTimerInterval: null });
  },

  markPlayCounted: () => {
    set({ hasCountedPlay: true });
    const track = get().currentTrack;
    if (track) {
      const userId = useAuthStore.getState().session?.user?.id;
      supabase.rpc('increment_play_count', { 
        track_id_input: track.id,
        user_id_input: userId || null
      }).then();
    }
  },

  cleanup: async () => {
    await TrackPlayer.reset();
  },

  setMode: (mode: PlayerMode, stationId?: string) => {
    set({ mode, liveStationId: stationId || null });
    if (mode === 'listener') {
      TrackPlayer.pause();
    }
  },

  setVolume: async (volume: number) => {
    await TrackPlayer.setVolume(volume);
  },

  addTrackToQueue: (track: Track) => {
    set(s => {
      const exists = s.queue.some(t => t.id === track.id);
      if (exists) return s;
      const idx = s.currentTrack ? s.queue.findIndex(t => t.id === s.currentTrack!.id) : -1;
      const q = [...s.queue];
      if (idx !== -1) {
        q.splice(idx + 1, 0, track);
      } else {
        q.push(track);
      }
      return { queue: q };
    });
  },

  removeTrackFromQueue: (index: number) => {
    set(s => {
      const newQueue = [...s.queue];
      newQueue.splice(index, 1);
      return { queue: newQueue };
    });
  },

  reorderQueue: (from: number, to: number) => {
    set(s => {
      const q = [...s.queue];
      const [item] = q.splice(from, 1);
      q.splice(to, 0, item);
      return { queue: q };
    });
  }
  }),
  {
    name: 'bongo-player-storage',
    storage: createJSONStorage(() => AsyncStorage),
    // Only persist currentTrack and queue — runtime state like timers/mode stays ephemeral
    partialize: (state) => ({
      currentTrack: state.currentTrack,
      queue: state.queue,
    }),
  }
));

// Module-local guard: a global flag survived Fast Refresh and left the fresh
// module with no listeners registered.
let _playerListenersRegistered = false;
if (!_playerListenersRegistered) {
  try {
    _playerListenersRegistered = true;
    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, async (event) => {
      const store = usePlayerStore.getState();
      usePlayerStore.setState({
        positionMs: Math.max(0, (event.position || 0) * 1000),
        durationMs: isFinite(event.duration) ? Math.max(0, (event.duration || 0) * 1000) : 0,
      });
      if (event.position > 30 && !store.hasCountedPlay) {
        store.markPlayCounted();
      }
    });

    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
      const store = usePlayerStore.getState();
      if (store.repeatMode === 'one') {
        await TrackPlayer.seekTo(0);
        await TrackPlayer.play();
      } else {
        store.skipNext();
      }
    });

    TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
      notifyPlaybackState(mapTPState(event.state));
    });
  } catch(e) {}
}
