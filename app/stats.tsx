// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, Stack } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';


export default function StatsScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const session = useAuthStore(s => s.session);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTracks: 0,
    totalMinutes: 0,
    topArtists: [] as { name: string, count: number }[],
    recentTracks: [] as any[]
  });

  useFocusEffect(
    useCallback(() => {
      if (session?.user.id) {
        loadStats();
      } else {
        setLoading(false);
      }
    }, [session])
  );

  const loadStats = async () => {
    setLoading(true);
    try {
      // Fetch recent listening history
      const { data: history } = await supabase
        .from('listening_history')
        .select('*, tracks(*, profile:profiles!tracks_user_id_fkey(*))')
        .eq('user_id', session!.user.id)
        .order('listened_at', { ascending: false });

      if (history && history.length > 0) {
        let totalMins = 0;
        const artistCounts: Record<string, number> = {};

        history.forEach(h => {
          totalMins += (h.duration_listened || 0) / 60;
          const artistName = h.tracks?.artist_name || h.tracks?.profile?.display_name || 'Unknown';
          artistCounts[artistName] = (artistCounts[artistName] || 0) + 1;
        });

        const topArtists = Object.entries(artistCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));

        // Deduplicate recent tracks
        const uniqueTracks = [];
        const seenIds = new Set();
        for (const h of history) {
          if (h.tracks && !seenIds.has(h.tracks.id)) {
            uniqueTracks.push(h.tracks);
            seenIds.add(h.tracks.id);
          }
          if (uniqueTracks.length === 10) break;
        }

        setStats({
          totalTracks: history.length,
          totalMinutes: Math.round(totalMins),
          topArtists,
          recentTracks: uniqueTracks
        });
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (!session) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={48} color={COLORS.textSecondary} />
        <Text style={styles.emptyText}>Please login to see your stats</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <LinearGradient colors={[COLORS.gold + '33', 'transparent']} style={styles.header}>
        <Text style={styles.title}>Bongo Wrapped</Text>
        <Text style={styles.subtitle}>Your Listening Habits</Text>
      </LinearGradient>

      {stats.totalTracks === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>You haven't listened to any tracks yet.</Text>
          <Text style={styles.emptySub}>Start exploring music to generate your stats!</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Big Stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="headset" size={24} color={COLORS.gold} style={styles.statIcon} />
              <Text style={styles.statValue}>{stats.totalTracks}</Text>
              <Text style={styles.statLabel}>Plays</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time" size={24} color={COLORS.gold} style={styles.statIcon} />
              <Text style={styles.statValue}>{stats.totalMinutes}</Text>
              <Text style={styles.statLabel}>Minutes</Text>
            </View>
          </View>

          {/* Top Artists */}
          <Text style={styles.sectionTitle}>Top Artists</Text>
          <View style={styles.artistsCard}>
            {stats.topArtists.map((artist, idx) => (
              <View key={artist.name} style={styles.artistRow}>
                <View style={styles.artistRank}>
                  <Text style={styles.rankText}>#{idx + 1}</Text>
                </View>
                <Text style={styles.artistName} numberOfLines={1}>{artist.name}</Text>
                <Text style={styles.artistPlays}>{artist.count} plays</Text>
              </View>
            ))}
          </View>

          {/* Recent Tracks */}
          <Text style={styles.sectionTitle}>Recently Played</Text>
          {stats.recentTracks.map(track => (
            <View key={track.id} style={styles.trackCard}>
              <Image source={{ uri: track.cover_url || undefined }} style={styles.trackImage} transition={200} />
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.trackArtist} numberOfLines={1}>{track.artist_name || track.profile?.display_name}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  center: { flex: 1, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 60, paddingBottom: 30, paddingHorizontal: 20 },
  title: { color: COLORS.gold, fontSize: 32, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: COLORS.textSecondary, fontSize: 16, marginTop: 4 },
  
  content: { paddingHorizontal: 20 },
  
  statsGrid: { flexDirection: 'row', gap: 16, marginBottom: 30 },
  statCard: { flex: 1, backgroundColor: COLORS.card, padding: 20, borderRadius: 20, alignItems: 'center' },
  statIcon: { marginBottom: 12 },
  statValue: { color: COLORS.textPrimary, fontSize: 32, fontWeight: '800' },
  statLabel: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4 },
  
  sectionTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 16, marginTop: 10 },
  
  artistsCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 16, marginBottom: 30 },
  artistRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  artistRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(212,175,55,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rankText: { color: COLORS.gold, fontSize: 12, fontWeight: '700' },
  artistName: { flex: 1, color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  artistPlays: { color: COLORS.textSecondary, fontSize: 14 },
  
  trackCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 12, borderRadius: 16, marginBottom: 12 },
  trackImage: { width: 48, height: 48, borderRadius: 8, backgroundColor: COLORS.cardAlt, marginRight: 12 },
  trackInfo: { flex: 1 },
  trackTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  trackArtist: { color: COLORS.textSecondary, fontSize: 13 },
  
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptySub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center' },
});
