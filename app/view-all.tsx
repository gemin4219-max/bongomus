// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';
import { usePlayerStore } from '../store/playerStore';
import { Track } from '../constants';
import AcrylicShelfItem from '../components/AcrylicShelfItem';

export default function ViewAllScreen() {
  const { type, id } = useLocalSearchParams<{ type: string, id?: string }>();
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [type]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (type === 'albums') {
        const { data, error } = await supabase.from('playlists').select('*, profile:profiles!playlists_user_id_fkey(*)').order('created_at', { ascending: false }).limit(50);
        if (data) setAlbums(data as Playlist[]);
        if (error) console.error(error);
      } else {
        let query = buildQuery();
        const { data, error } = await query;
        if (data) setTracks(data as Track[]);
        if (error) console.error(error);
      }
    } catch (e) {
      console.log('Error loading data:', e);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (type === 'spotlight') return 'Spotlight';
    if (type === 'trending') return 'Trending';
    if (type === 'staff-picks') return 'Staff Picks';
    if (type === 'ai-studio') return 'Made in AI Studio';
    if (type === 'jump-back') return 'Jump Back In';
    if (type === 'new-releases') return 'New Releases';
    if (type === 'trending-now') return 'Trending Now';
    if (type === 'albums') return 'Albums';
    if (type === 'category' && id) return id;
    return 'All Tracks';
  };

  // Map type to query
  const buildQuery = () => {
    let q = supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).limit(50);
    if (type === 'spotlight') return q.order('like_count', { ascending: false });
    if (type === 'trending' || type === 'trending-now' || type === 'staff-picks') return q.order('play_count', { ascending: false });
    if (type === 'ai-studio') return q.eq('is_ai', true).order('play_count', { ascending: false });
    if (type === 'new-releases') return q.order('created_at', { ascending: false });
    if (type === 'category' && id) return q.ilike('genre', `%${id}%`).order('play_count', { ascending: false });
    return q.order('play_count', { ascending: false });
  };

  const renderItem = ({ item, index }: { item: Track, index: number }) => (
    <TouchableOpacity 
      style={styles.trackCard} 
      onPress={() => playTrack(item, tracks)}
    >
      <Text style={styles.rankText}>{(index + 1).toString().padStart(2, '0')}</Text>
      <Image source={{ uri: item.cover_url || undefined }} style={styles.trackImage} />
      <View style={styles.trackInfo}>
        <Text style={[styles.trackTitle, currentTrack?.id === item.id && { color: COLORS.gold }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1}>{item.artist_name}</Text>
      </View>
      <View style={styles.statsWrap}>
        <Ionicons name="play" size={10} color={COLORS.textSecondary} />
        <Text style={styles.statsText}>{item.play_count || 0}</Text>
      </View>
      {currentTrack?.id === item.id ? (
        <Ionicons name="volume-medium" size={20} color={COLORS.gold} style={styles.actionIcon} />
      ) : (
        <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} style={styles.actionIcon} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <LinearGradient colors={['rgba(212,175,55,0.15)', 'transparent']} style={StyleSheet.absoluteFill} />
      
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getTitle()}</Text>
          <View style={{ width: 28 }} />
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.gold} />
          </View>
        ) : type === 'albums' ? (
          <FlatList
            data={albums}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16 }}
            contentContainerStyle={[styles.listContent, { paddingTop: 24 }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={{ width: '48%', alignItems: 'center' }}>
                <AcrylicShelfItem
                  title={item.title}
                  subtitle={`${item.track_count} tracks`}
                  imageSource={item.cover_url || undefined}
                  onPress={() => router.push(`/playlist/${item.id}`)}
                />
              </View>
            )}
            ListEmptyComponent={
              <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 }}>
                Hakuna albamu zilizopatikana (No albums found)
              </Text>
            }
          />
        ) : (
          <FlatList
            data={tracks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={renderItem}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <Text style={styles.trackCount}>{tracks.length} Tracks</Text>
                <TouchableOpacity style={styles.playAllBtn} onPress={() => tracks.length > 0 && playTrack(tracks[0], tracks)}>
                  <Ionicons name="play" size={20} color={COLORS.black} style={{ marginLeft: 2 }} />
                  <Text style={styles.playAllText}>Play All</Text>
                </TouchableOpacity>
              </View>
            }
            ListEmptyComponent={
              <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 }}>
                Hakuna nyimbo zilizopatikana (No tracks found)
              </Text>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || '#0A0A0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
  },
  headerTitle: {
    color: COLORS.textPrimary || '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  trackCount: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  playAllText: {
    color: COLORS.black,
    fontWeight: '800',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  rankText: {
    color: COLORS.textTertiary,
    fontSize: 14,
    fontWeight: '800',
    width: 24,
    marginRight: 8,
    textAlign: 'center',
  },
  trackImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  trackInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  trackTitle: {
    color: COLORS.textPrimary || '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  trackArtist: {
    color: COLORS.textSecondary || '#aaa',
    fontSize: 13,
  },
  statsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statsText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  actionIcon: {
    padding: 8,
  },
});
