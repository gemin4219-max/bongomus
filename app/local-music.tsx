// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/themeStore';
import { usePlayerStore } from '../store/playerStore';
import { Track } from '../constants';

export default function LocalMusicScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const isPlaying = usePlayerStore(s => s.isPlaying);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      if (status === 'granted') {
        loadAudioFiles();
      } else {
        setLoading(false);
      }
    })();
  }, []);

  const loadAudioFiles = async () => {
    setLoading(true);
    try {
      // Get all audio files
      const media = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.audio,
        first: 100, // Load first 100
        sortBy: [MediaLibrary.SortBy.creationTime],
      });
      setAssets(media.assets);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to scan local audio files: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayLocal = (asset: MediaLibrary.Asset) => {
    // Map the local asset to our Track type so the player can use it
    const localTrack: Track = {
      id: `local_${asset.id}`,
      user_id: 'local_device',
      title: asset.filename.replace(/\.[^/.]+$/, ""), // remove extension
      artist_name: 'Local Music',
      genre: 'Local',
      cover_url: null,
      audio_url: asset.uri,
      description: null,
      is_public: false,
      created_at: new Date(asset.creationTime || Date.now()).toISOString(),
    };

    // We can pass a mock array of 1 item, or if we want queue support, we map all assets.
    const playlist = assets.map(a => ({
      id: `local_${a.id}`,
      user_id: 'local_device',
      title: a.filename.replace(/\.[^/.]+$/, ""),
      artist_name: 'Local Music',
      genre: 'Local',
      cover_url: null,
      audio_url: a.uri,
      description: null,
      is_public: false,
      created_at: new Date(a.creationTime || Date.now()).toISOString(),
    }));

    playTrack(localTrack, playlist);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (hasPermission === false) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <Ionicons name="folder-open-outline" size={64} color={COLORS.textTertiary} />
        <Text style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 16 }}>Permission Denied</Text>
        <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 }}>
          Bongo Stream needs permission to access your device storage to play local music.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={() => MediaLibrary.requestPermissionsAsync()}>
          <Text style={styles.permissionText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Device Music',
          headerStyle: { backgroundColor: COLORS.darkSurface },
          headerTintColor: COLORS.textPrimary,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 20 }}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={loadAudioFiles} style={{ paddingLeft: 20 }}>
              <Ionicons name="refresh" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          )
        }} 
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={{ color: COLORS.textSecondary, marginTop: 16 }}>Scanning device for audio...</Text>
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={64} color={COLORS.textTertiary} />
              <Text style={styles.emptyTitle}>No Music Found</Text>
              <Text style={styles.emptySub}>We couldn't find any audio files on your device.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPlayingThis = currentTrack?.id === `local_${item.id}`;
            return (
              <TouchableOpacity 
                style={[styles.trackRow, isPlayingThis && { backgroundColor: COLORS.cardAlt }]} 
                onPress={() => handlePlayLocal(item)}
              >
                <View style={styles.iconBox}>
                  {isPlayingThis && isPlaying ? (
                    <Ionicons name="stats-chart" size={16} color={COLORS.gold} />
                  ) : (
                    <Ionicons name="musical-note" size={20} color={COLORS.textTertiary} />
                  )}
                </View>
                <View style={styles.trackInfo}>
                  <Text style={[styles.trackTitle, isPlayingThis && { color: COLORS.gold }]} numberOfLines={1}>
                    {item.filename.replace(/\.[^/.]+$/, "")}
                  </Text>
                  <Text style={styles.trackDuration}>{formatTime(item.duration)}</Text>
                </View>
                <TouchableOpacity style={{ padding: 8 }}>
                  <Ionicons name="ellipsis-vertical" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  listContent: { padding: 16, paddingBottom: 100 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  iconBox: { width: 44, height: 44, borderRadius: 8, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  trackInfo: { flex: 1 },
  trackTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  trackDuration: { color: COLORS.textSecondary, fontSize: 13 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 16 },
  emptySub: { color: COLORS.textSecondary, marginTop: 8 },
  permissionBtn: { backgroundColor: COLORS.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 24 },
  permissionText: { color: COLORS.black, fontWeight: '800', fontSize: 16 },
});
