import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, { 
  Event, 
  State as TPState, 
  AppKilledPlaybackBehavior, 
  Capability, 
  IOSCategory, 
  IOSCategoryMode, 
  IOSCategoryOptions, 
  PitchAlgorithm 
} from 'react-native-track-player';

import { Track } from '../constants';
import { useOfflineStore } from './offlineStore';
import { useAuthStore } from './authStore';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import * as React from 'react';
import { Alert } from 'react-native';
import { Audio } from '@/mock-expo-av';

let backgroundBeatSound: Audio.Sound | null = null;

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
  repeatOne: boolean;
  playbackRate: number;
  sleepTimerMs: number | null;
  sleepTimerInterval: any | null;
  hasCountedPlay: boolean;
  isPlayerReady: boolean;
  mode: PlayerMode;
  liveStationId: string | null;

  initPlayer: () => Promise<void>;
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  pause: () => Promise<void>;
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

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({

  currentTrack: null,
  queue: [],
  isShuffled: false,
  repeatOne: false,
  playbackRate: 1.0,
  sleepTimerMs: null,
  sleepTimerInterval: null,
  hasCountedPlay: false,
  isPlayerReady: false,
  mode: 'local',
  liveStationId: null,

  initPlayer: async () => {
    if (get().isPlayerReady) return;
    try {
      try {
        const { InterruptionModeIOS, InterruptionModeAndroid } = { InterruptionModeIOS: { DoNotMix: 0 }, InterruptionModeAndroid: { DoNotMix: 0 } };
        await Audio.setAudioModeAsync({ 
          allowsRecordingIOS: false,
          staysActiveInBackground: true, 
          playsInSilentModeIOS: true,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          playThroughEarpieceAndroid: false
        });
      } catch (e) {}

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
          let url = decryptedUri || persistedTrack.audio_url;
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
            tpTrack.artwork = persistedTrack.cover_url;
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
    let url = decryptedUri || track.audio_url;

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
      tpTrack.artwork = track.cover_url;
    } else if (offlineCoverUri) {
      tpTrack.artwork = 'file://' + offlineCoverUri.replace('file://', '');
    } else if (!decryptedUri) {
      tpTrack.artwork = 'https://via.placeholder.com/150';
    } else {
      tpTrack.artwork = require('../assets/icon.png');
    }

    try {
      await TrackPlayer.reset();

      if (backgroundBeatSound) {
        await backgroundBeatSound.stopAsync();
        await backgroundBeatSound.unloadAsync();
        backgroundBeatSound = null;
      }

      if (track.parent_beat_id) {
        try {
          const { data: beatData } = await supabase.from('tracks').select('audio_url').eq('id', track.parent_beat_id).single();
          if (beatData?.audio_url) {
            const { sound } = await Audio.Sound.createAsync({ uri: beatData.audio_url });
            backgroundBeatSound = sound;
            await backgroundBeatSound.setIsLoopingAsync(true);
            await backgroundBeatSound.playAsync();
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
      if (backgroundBeatSound) await backgroundBeatSound.pauseAsync();
    } else {
      await TrackPlayer.play();
      if (backgroundBeatSound) await backgroundBeatSound.playAsync();
    }
  },

  pause: async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const state = (await TrackPlayer.getPlaybackState()).state;
    if (state === TPState.Playing) {
      await TrackPlayer.pause();
      if (backgroundBeatSound) await backgroundBeatSound.pauseAsync();
    }
  },

  skipNext: async () => {
    if (get().mode === 'listener') return;
    const { queue, currentTrack, isShuffled, playTrack } = get();
    if (!currentTrack || queue.length === 0) return;
    
    const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
    
    // Auto Play logic for when the queue ends
    if (!isShuffled && currentIdx === queue.length - 1) {
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
    set(s => ({ repeatOne: !s.repeatOne }));
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

if (!(global as any)._playerListenersRegistered) {
  try {
    (global as any)._playerListenersRegistered = true;
    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, async (event) => {
      const store = usePlayerStore.getState();
      if (event.position > 30 && !store.hasCountedPlay) {
        store.markPlayCounted();
      }
    });

    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
      const store = usePlayerStore.getState();
      if (store.repeatOne) {
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
