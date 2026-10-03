import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as CryptoJS from 'crypto-js';
import { Alert } from 'react-native';
import { Track } from '../constants';

const SECRET_KEY = 'bongo_stream_offline_secure_key_2024';

type OfflineStore = {
  downloadedTracks: Record<string, Track & { localUri: string; localCoverUri?: string }>;
  isDownloading: Record<string, boolean>;
  downloadProgress: Record<string, number>;
  
  downloadTrack: (track: Track) => Promise<void>;
  deleteDownload: (trackId: string) => Promise<void>;
  isDownloaded: (trackId: string) => boolean;
  getLocalUri: (trackId: string) => string | null;
  getDecryptedUri: (trackId: string) => Promise<string | null>;
  getOfflineCoverUri: (trackId: string) => Promise<string | null>;
};

const getCdnUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.includes('gqxdbwnmnqvtdpxnrgtx.supabase.co')) {
    return url.replace('gqxdbwnmnqvtdpxnrgtx.supabase.co', 'bongo-cdn.meerkal70.workers.dev');
  }
  return url;
};

export const useOfflineStore = create<OfflineStore>()(
  persist(
    (set, get) => ({
      downloadedTracks: {},
      isDownloading: {},
      downloadProgress: {},

      downloadTrack: async (track) => {
        if (get().isDownloaded(track.id)) return;
        
        set((state) => ({
          isDownloading: { ...state.isDownloading, [track.id]: true },
          downloadProgress: { ...state.downloadProgress, [track.id]: 0 }
        }));

        try {
          // Determine extension (default mp3)
          let ext = track.audio_url.split('.').pop()?.split('?')[0] || 'mp3';
          if (!/^[a-zA-Z0-9]{2,4}$/.test(ext)) {
            ext = 'mp3';
          }
          const fileUri = `${FileSystem.documentDirectory}track_${track.id}.${ext}`;
          
          let lastUpdate = 0;
          const cdnAudioUrl = getCdnUrl(track.audio_url) || track.audio_url;
          const downloadResumable = FileSystem.createDownloadResumable(
            cdnAudioUrl,
            fileUri,
            {},
            (downloadProgress) => {
              const now = Date.now();
              // Throttle UI updates to every 250ms to prevent massive JS thread lag on large files
              if (now - lastUpdate > 250 || downloadProgress.totalBytesWritten === downloadProgress.totalBytesExpectedToWrite) {
                lastUpdate = now;
                const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                set((state) => ({
                  downloadProgress: { ...state.downloadProgress, [track.id]: progress }
                }));
              }
            }
          );

          const result = await downloadResumable.downloadAsync();
          
          if (result && result.uri) {
            // Memory optimization: The previous CryptoJS approach crashed the JS thread 
            // due to loading massive Base64 audio strings into memory.
            // Since FileSystem.documentDirectory is already sandboxed by iOS/Android OS, 
            // the files are inherently protected from casual access.
            // The downloaded file is already at fileUri (result.uri).
            // We just need to save it to state.
            const finalUri = result.uri;

            let localCoverUri: string | undefined = undefined;
            if (track.cover_url) {
              const coverExt = track.cover_url.split('.').pop()?.split('?')[0] || 'jpg';
              const coverFileUri = `${FileSystem.documentDirectory}cover_${track.id}.${coverExt}`;
              try {
                const cdnCoverUrl = getCdnUrl(track.cover_url) || track.cover_url;
                const coverResult = await FileSystem.downloadAsync(cdnCoverUrl, coverFileUri);
                if (coverResult && coverResult.uri) {
                  localCoverUri = coverResult.uri;
                }
              } catch(e) {
                console.log('Failed to download cover art', e);
              }
            }

            set((state) => ({
              downloadedTracks: {
                ...state.downloadedTracks,
                [track.id]: { ...track, localUri: finalUri, localCoverUri }
              }
            }));
          }
        } catch (error) {
          console.error("Failed to download track:", error);
          Alert.alert("Download Failed", "There was an error downloading the track. Please try again.");
        } finally {
          set((state) => {
            const { [track.id]: _, ...restDownloading } = state.isDownloading;
            const { [track.id]: __, ...restProgress } = state.downloadProgress;
            return {
              isDownloading: restDownloading,
              downloadProgress: restProgress
            };
          });
        }
      },

      deleteDownload: async (trackId) => {
        const track = get().downloadedTracks[trackId];
        if (!track) return;
        
        try {
          await FileSystem.deleteAsync(track.localUri, { idempotent: true });
        } catch (error) {
          console.error("Failed to delete local file:", error);
        }
        
        set((state) => {
          const { [trackId]: _, ...rest } = state.downloadedTracks;
          return { downloadedTracks: rest };
        });
      },

      isDownloaded: (trackId) => !!get().downloadedTracks[trackId],
      
      getLocalUri: (trackId) => {
        return get().downloadedTracks[trackId]?.localUri || null;
      },

      getDecryptedUri: async (trackId) => {
        const track = get().downloadedTracks[trackId];
        if (!track || !track.localUri) return null;

        // Fix iOS Path Bug: iOS changes the app's Document directory UUID randomly on reboots/updates.
        // We must extract the filename and append it to the CURRENT documentDirectory.
        const filename = track.localUri.split('/').pop();
        const currentUri = FileSystem.documentDirectory + filename;

        try {
          const info = await FileSystem.getInfoAsync(currentUri);
          if (info.exists && info.size > 0) {
            return currentUri;
          }
        } catch (e) {
          console.error("Failed to verify offline file", e);
          Alert.alert("Playback Error", "The downloaded track file could not be verified. It may be corrupted or deleted.");
        }
        
        return null;
      },

      getOfflineCoverUri: async (trackId) => {
        const track = get().downloadedTracks[trackId];
        if (!track || !track.localCoverUri) return null;

        const filename = track.localCoverUri.split('/').pop();
        const currentUri = FileSystem.documentDirectory + filename;

        try {
          const info = await FileSystem.getInfoAsync(currentUri);
          if (info.exists && info.size > 0) {
            return currentUri;
          }
        } catch (e) {
          console.error("Failed to verify offline cover image", e);
        }
        
        return null;
      },
    }),
    {
      name: 'bongo-offline-storage',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version === 0 || version === 1) {
          // Wipe old unencrypted tracks when migrating to v2
          return { downloadedTracks: {} };
        }
        return persistedState;
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ downloadedTracks: state.downloadedTracks }), // Only persist completed downloads
    }
  )
);
