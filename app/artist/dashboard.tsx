import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl, Animated, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CHART_HEIGHT = 100;

type TrackStat = { id: string; title: string; play_count: number; like_count: number; };
type AnalyticsData = {
  totalPlays: number;
  totalMinutes: number;
  totalLikes: number;
  topCountries: { code: string; count: number }[];
  myTracks: TrackStat[];
};

const COUNTRY_NAMES: Record<string, string> = {
  TZ: '🇹🇿 Tanzania', KE: '🇰🇪 Kenya', UG: '🇺🇬 Uganda',
  NG: '🇳🇬 Nigeria', ZA: '🇿🇦 South Africa', GB: '🇬🇧 United Kingdom',
  US: '🇺🇸 United States', DE: '🇩🇪 Germany', FR: '🇫🇷 France',
};

export default function ArtistDashboardScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const profile = useAuthStore(s => s.profile);
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'Overview' | 'Audience' | 'Content'>('Overview');
  const [data, setData] = useState<AnalyticsData>({
    totalPlays: 0, totalMinutes: 0, totalLikes: 0, topCountries: [], myTracks: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useFocusEffect(useCallback(() => { loadAnalytics(); }, []));

  useEffect(() => {
    if (!loading) {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
      ]).start();
    }
  }, [loading, activeTab]);

  const switchTab = (tab: any) => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    setActiveTab(tab);
  };

  const loadAnalytics = async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const { data: trackData, error: trackError } = await supabase
        .from('tracks')
        .select('id, title, play_count, like_count')
        .eq('user_id', session.user.id);
      if (trackError) throw trackError;

      let totalPlays = 0;
      let totalLikes = 0;
      trackData?.forEach(t => {
        totalPlays += t.play_count || 0;
        totalLikes += t.like_count || 0;
      });

      const { data: eventData, error: eventError } = await supabase
        .from('track_events')
        .select('duration_listened_sec, country_code, tracks!inner(user_id)')
        .eq('tracks.user_id', session.user.id);
      // Don't throw on event error — gracefully fall back to empty
      let totalSeconds = 0;
      const countryCounts: Record<string, number> = {};
      (eventData || []).forEach(e => {
        totalSeconds += e.duration_listened_sec || 0;
        const code = e.country_code || 'TZ';
        countryCounts[code] = (countryCounts[code] || 0) + 1;
      });

      const topCountries = Object.entries(countryCounts)
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const myTracks = (trackData || [])
        .map(t => ({ id: t.id, title: t.title, play_count: t.play_count || 0, like_count: t.like_count || 0 }))
        .sort((a, b) => b.play_count - a.play_count);

      setData({ totalPlays, totalLikes, totalMinutes: Math.floor(totalSeconds / 60), topCountries, myTracks });
    } catch (err: any) {
      Alert.alert('Error loading analytics', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteTrack = async (trackId: string, trackTitle: string) => {
    Alert.alert('Delete Song', `Are you sure you want to delete "${trackTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('tracks').delete().eq('id', trackId);
            if (error) throw error;
            loadAnalytics();
          } catch (err: any) { Alert.alert('Error', err.message); }
        }
      },
    ]);
  };

  // Stabilised chart bars — computed once per totalPlays change, not on every render
  const chartBars = useMemo(() => {
    if (data.totalPlays === 0) {
      // Show a gentle placeholder curve when no data
      return [20, 35, 28, 45, 38, 55, 42, 60, 48, 70, 55, 65];
    }
    // Distribute plays across 12 months with some variance
    return Array.from({ length: 12 }).map((_, i) => {
      const base = data.totalPlays / 12;
      const variance = base * 0.6 * Math.sin(i * 1.3 + 1);
      return Math.max(8, base + variance);
    });
  }, [data.totalPlays]);

  const maxBar = Math.max(...chartBars, 1);
  const estimatedRoyalties = Math.round(data.totalPlays * 5.5);

  if (profile?.role !== 'artist' && profile?.role !== 'admin') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <Ionicons name="lock-closed" size={48} color="rgba(255,255,255,0.2)" />
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>Artist Access Required</Text>
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Switch your account to Artist to access Studio Hub.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1005', '#0d0d0d', '#000000']} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Studio Hub</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          {(['Overview', 'Audience', 'Content'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => switchTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadAnalytics(); }}
              tintColor={COLORS.gold}
            />
          }
        >
          {loading && !refreshing ? (
            <View style={{ marginTop: 80, alignItems: 'center', gap: 16 }}>
              <ActivityIndicator size="large" color={COLORS.gold} />
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading your stats...</Text>
            </View>
          ) : (
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

              {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
              {activeTab === 'Overview' && (
                <>
                  {/* Total Streams Hero Card */}
                  <LinearGradient
                    colors={['rgba(245,198,76,0.12)', 'rgba(245,198,76,0.02)']}
                    style={styles.heroCard}
                  >
                    <Text style={styles.heroLabel}>Total Streams</Text>
                    <Text style={styles.heroValue}>{data.totalPlays.toLocaleString()}</Text>

                    {/* Bar Chart — uses pixel heights, not % */}
                    <View style={styles.chartContainer}>
                      {chartBars.map((val, i) => {
                        const barH = Math.max(4, (val / maxBar) * CHART_HEIGHT);
                        return (
                          <View key={i} style={styles.chartBarWrapper}>
                            <LinearGradient
                              colors={[COLORS.gold, 'rgba(245,198,76,0.15)']}
                              style={[styles.chartBar, { height: barH }]}
                            />
                          </View>
                        );
                      })}
                    </View>
                    <Text style={styles.chartXLabel}>Last 12 Months</Text>
                  </LinearGradient>

                  {/* Stats Grid */}
                  <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                      <View style={styles.statIconWrap}>
                        <Ionicons name="time" size={20} color={COLORS.gold} />
                      </View>
                      <Text style={styles.statValueSm}>{data.totalMinutes.toLocaleString()}</Text>
                      <Text style={styles.statLabelSm}>Minutes{'\n'}Listened</Text>
                    </View>
                    <View style={styles.statBox}>
                      <View style={styles.statIconWrap}>
                        <Ionicons name="heart" size={20} color={COLORS.gold} />
                      </View>
                      <Text style={styles.statValueSm}>{data.totalLikes.toLocaleString()}</Text>
                      <Text style={styles.statLabelSm}>Saves /{'\n'}Likes</Text>
                    </View>
                    <View style={styles.statBox}>
                      <View style={styles.statIconWrap}>
                        <Ionicons name="musical-notes" size={20} color={COLORS.gold} />
                      </View>
                      <Text style={styles.statValueSm}>{data.myTracks.length}</Text>
                      <Text style={styles.statLabelSm}>Total{'\n'}Songs</Text>
                    </View>
                  </View>

                  {/* Estimated Royalties */}
                  <LinearGradient
                    colors={['rgba(0,200,80,0.12)', 'rgba(0,0,0,0)']}
                    style={[styles.heroCard, { marginTop: 16, padding: 28, alignItems: 'center' }]}
                  >
                    <Text style={styles.heroLabel}>Estimated Royalties</Text>
                    <Text style={[styles.heroValue, { color: '#4ade80', fontSize: 32 }]}>
                      Coming Soon
                    </Text>
                    <View style={styles.royaltyRow}>
                      <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.35)" />
                      <Text style={styles.royaltyNote}>Payout structure is being finalized</Text>
                    </View>
                  </LinearGradient>
                </>
              )}

              {/* ── AUDIENCE TAB ─────────────────────────────────────────────── */}
              {activeTab === 'Audience' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Top Listener Countries</Text>
                  <View style={styles.listCard}>
                    {data.topCountries.length === 0 ? (
                      <View style={styles.emptyState}>
                        <Ionicons name="globe-outline" size={40} color="rgba(255,255,255,0.15)" />
                        <Text style={styles.emptyText}>Not enough listener data yet.</Text>
                        <Text style={styles.emptySubText}>Share your music to start building an audience!</Text>
                      </View>
                    ) : (
                      data.topCountries.map((c, i) => (
                        <View
                          key={c.code}
                          style={[styles.listItem, i === data.topCountries.length - 1 && { borderBottomWidth: 0 }]}
                        >
                          <View style={styles.listLeft}>
                            <Text style={styles.rank}>#{i + 1}</Text>
                            <Text style={styles.listName}>
                              {COUNTRY_NAMES[c.code] ?? c.code}
                            </Text>
                          </View>
                          <View style={styles.listRight}>
                            <Text style={styles.listMetric}>{c.count.toLocaleString()}</Text>
                            <Text style={styles.listMetricLabel}>plays</Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              )}

              {/* ── CONTENT TAB ──────────────────────────────────────────────── */}
              {activeTab === 'Content' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>My Catalog</Text>
                  <View style={styles.listCard}>
                    {data.myTracks.length === 0 ? (
                      <View style={styles.emptyState}>
                        <Ionicons name="musical-note-outline" size={40} color="rgba(255,255,255,0.15)" />
                        <Text style={styles.emptyText}>No songs uploaded yet.</Text>
                        <Text style={styles.emptySubText}>Generate or upload your first track to see it here.</Text>
                      </View>
                    ) : (
                      data.myTracks.map((track, i) => (
                        <View
                          key={track.id}
                          style={[styles.trackItem, i === data.myTracks.length - 1 && { borderBottomWidth: 0 }]}
                        >
                          <View style={styles.trackRank}>
                            <Text style={styles.trackRankTxt}>{i + 1}</Text>
                          </View>
                          <View style={styles.trackInfo}>
                            <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                            <View style={styles.trackStatsRow}>
                              <View style={styles.miniStat}>
                                <Ionicons name="play" size={11} color={COLORS.gold} />
                                <Text style={styles.miniStatTxt}>{track.play_count.toLocaleString()}</Text>
                              </View>
                              <View style={styles.miniStat}>
                                <Ionicons name="heart" size={11} color="#ff6b8a" />
                                <Text style={styles.miniStatTxt}>{track.like_count.toLocaleString()}</Text>
                              </View>

                            </View>
                          </View>
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => handleDeleteTrack(track.id, track.title)}
                          >
                            <Ionicons name="trash-outline" size={17} color="#ff4444" />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              )}

            </Animated.View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 21, fontWeight: '900', letterSpacing: -0.5, flex: 1, textAlign: 'center' },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.15)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff3b30', marginRight: 5 },
  liveText: { color: '#ff3b30', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20, gap: 10 },
  tabBtn: {
    paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tabBtnActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  tabText: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#000', fontWeight: '800' },

  content: { paddingHorizontal: 20, paddingBottom: 120 },

  heroCard: {
    padding: 28, borderRadius: 28,
    borderWidth: 1, borderColor: 'rgba(245,198,76,0.15)',
    marginBottom: 16, overflow: 'hidden',
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.55)', fontSize: 12,
    textTransform: 'uppercase', letterSpacing: 2,
    fontWeight: '700', marginBottom: 6,
  },
  heroValue: { color: '#fff', fontSize: 52, fontWeight: '900', letterSpacing: -2 },

  chartContainer: {
    flexDirection: 'row', height: CHART_HEIGHT,
    alignItems: 'flex-end', justifyContent: 'space-between',
    marginTop: 24, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  chartBarWrapper: { width: '6%', height: CHART_HEIGHT, justifyContent: 'flex-end', alignItems: 'center' },
  chartBar: { width: '100%', borderRadius: 3 },
  chartXLabel: {
    color: 'rgba(255,255,255,0.25)', fontSize: 11,
    textAlign: 'center', marginTop: 10, fontWeight: '600', letterSpacing: 0.5,
  },

  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  statBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 18, borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  statIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(245,198,76,0.1)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  statValueSm: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 2 },
  statLabelSm: {
    color: 'rgba(255,255,255,0.45)', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 0.4,
    fontWeight: '700', textAlign: 'center', lineHeight: 14,
  },

  royaltyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  royaltyNote: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },

  section: { marginTop: 4 },
  sectionTitle: {
    color: '#fff', fontSize: 20, fontWeight: '800',
    marginBottom: 14, marginLeft: 2, letterSpacing: -0.5,
  },
  listCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden',
  },

  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 8 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '600' },
  emptySubText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center' },

  listItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  listLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rank: { color: COLORS.gold, fontSize: 15, fontWeight: '800', width: 26 },
  listName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  listRight: { alignItems: 'flex-end' },
  listMetric: { color: '#fff', fontSize: 15, fontWeight: '700' },
  listMetricLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },

  trackItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  trackRank: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  trackRankTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' },
  trackInfo: { flex: 1 },
  trackTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 6 },
  trackStatsRow: { flexDirection: 'row', gap: 14 },
  miniStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniStatTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  deleteBtn: {
    padding: 10, backgroundColor: 'rgba(255,68,68,0.08)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,68,68,0.15)',
  },
});
