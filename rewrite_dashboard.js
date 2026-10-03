const fs = require('fs');

const content = `import React, { useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassView as BlurView } from '@/components/GlassView';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

type TrackStat = { id: string; title: string; play_count: number; like_count: number; };
type AnalyticsData = { totalPlays: number; totalMinutes: number; totalLikes: number; topCountries: { code: string; count: number }[]; myTracks: TrackStat[]; };

export default function ArtistDashboardScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const profile = useAuthStore(s => s.profile);

  const [activeTab, setActiveTab] = useState<'Overview' | 'Audience' | 'Content'>('Overview');
  const [data, setData] = useState<AnalyticsData>({ totalPlays: 0, totalMinutes: 0, totalLikes: 0, topCountries: [], myTracks: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useFocusEffect(
    useCallback(() => { loadAnalytics(); }, [])
  );

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true })
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
      const { data: trackData, error: trackError } = await supabase.from('tracks').select('id, title, play_count, like_count').eq('user_id', session.user.id);
      if (trackError) throw trackError;

      let totalPlays = 0; let totalLikes = 0;
      trackData?.forEach(t => { totalPlays += t.play_count; totalLikes += t.like_count; });

      const { data: eventData, error: eventError } = await supabase.from('track_events').select('duration_listened_sec, country_code, tracks!inner(user_id)').eq('tracks.user_id', session.user.id);
      if (eventError) throw eventError;

      let totalSeconds = 0; const countryCounts: Record<string, number> = {};
      eventData?.forEach(e => {
        totalSeconds += e.duration_listened_sec || 0;
        const code = e.country_code || 'TZ'; // Defaulting to TZ for realistic demo
        countryCounts[code] = (countryCounts[code] || 0) + 1;
      });

      const topCountries = Object.entries(countryCounts).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count).slice(0, 5);
      const myTracks = (trackData || []).map(t => ({ id: t.id, title: t.title, play_count: t.play_count, like_count: t.like_count })).sort((a, b) => b.play_count - a.play_count);

      setData({ totalPlays, totalLikes, totalMinutes: Math.floor(totalSeconds / 60), topCountries, myTracks });
    } catch (err: any) { Alert.alert('Error', err.message); } finally { setLoading(false); setRefreshing(false); }
  };

  const handleDeleteTrack = async (trackId: string, trackTitle: string) => {
    Alert.alert('Delete Song', \`Are you sure you want to delete "\${trackTitle}"?\`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('tracks').delete().eq('id', trackId);
            if (error) throw error;
            loadAnalytics();
          } catch (err: any) { Alert.alert('Error', err.message); }
      }}
    ]);
  };

  if (profile?.role !== 'artist' && profile?.role !== 'admin') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 20 }}>Artist Access Required</Text>
      </View>
    );
  }

  // Simulated chart data
  const chartBars = Array.from({ length: 12 }).map((_, i) => Math.random() * data.totalPlays * 0.3 + 10);
  const maxBar = Math.max(...chartBars, 1);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1005', '#000000', '#000000']} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <Text style={styles.headerTitle}>Studio Hub</Text>
            <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          {['Overview', 'Audience', 'Content'].map(tab => (
            <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} onPress={() => switchTab(tab as any)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAnalytics(); }} tintColor={COLORS.gold} />}
        >
          {loading && !refreshing ? (
            <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 60 }} />
          ) : (
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
              
              {activeTab === 'Overview' && (
                <>
                  <LinearGradient colors={['rgba(245, 198, 76, 0.15)', 'rgba(245, 198, 76, 0.02)']} style={styles.heroCard}>
                    <Text style={styles.heroLabel}>Total Streams</Text>
                    <Text style={styles.heroValue}>{data.totalPlays.toLocaleString()}</Text>
                    
                    {/* Simulated Chart */}
                    <View style={styles.chartContainer}>
                      {chartBars.map((val, i) => (
                        <View key={i} style={styles.chartBarWrapper}>
                          <LinearGradient 
                            colors={[COLORS.gold, 'rgba(245, 198, 76, 0.2)']} 
                            style={[styles.chartBar, { height: \`\${(val / maxBar) * 100}%\` }]} 
                          />
                        </View>
                      ))}
                    </View>
                    <Text style={styles.chartXLabel}>Last 12 Months</Text>
                  </LinearGradient>

                  <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                      <View style={styles.statIconWrap}><Ionicons name="time" size={20} color={COLORS.gold} /></View>
                      <Text style={styles.statValueSm}>{data.totalMinutes.toLocaleString()}</Text>
                      <Text style={styles.statLabelSm}>Minutes Listened</Text>
                    </View>
                    <View style={styles.statBox}>
                      <View style={styles.statIconWrap}><Ionicons name="heart" size={20} color={COLORS.gold} /></View>
                      <Text style={styles.statValueSm}>{data.totalLikes.toLocaleString()}</Text>
                      <Text style={styles.statLabelSm}>Saves / Likes</Text>
                    </View>
                  </View>

                  <LinearGradient colors={['rgba(0,255,100,0.1)', 'rgba(0,0,0,0)']} style={[styles.heroCard, { marginTop: 16, padding: 24, alignItems: 'center' }]}>
                    <Text style={styles.heroLabel}>Estimated Royalties</Text>
                    <Text style={[styles.heroValue, { color: '#4ade80', fontSize: 36 }]}>TZS {(data.totalPlays * 5.5).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8 }}>Based on average payout rate per stream</Text>
                  </LinearGradient>
                </>
              )}

              {activeTab === 'Audience' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Top Listener Countries</Text>
                  <View style={styles.listCard}>
                    {data.topCountries.length === 0 ? <Text style={styles.emptyText}>Not enough data yet.</Text> : 
                      data.topCountries.map((c, i) => (
                        <View key={c.code} style={[styles.listItem, i === data.topCountries.length - 1 && { borderBottomWidth: 0 }]}>
                          <View style={styles.listLeft}>
                            <Text style={styles.rank}>#{i + 1}</Text>
                            <Text style={styles.listName}>{c.code === 'TZ' ? 'Tanzania' : c.code === 'KE' ? 'Kenya' : c.code}</Text>
                          </View>
                          <Text style={styles.listMetric}>{c.count.toLocaleString()} plays</Text>
                        </View>
                      ))
                    }
                  </View>
                </View>
              )}

              {activeTab === 'Content' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>My Catalog</Text>
                  <View style={styles.listCard}>
                    {data.myTracks.length === 0 ? <Text style={styles.emptyText}>You haven't uploaded any songs yet.</Text> : 
                      data.myTracks.map((track, i) => (
                        <View key={track.id} style={[styles.trackItem, i === data.myTracks.length - 1 && { borderBottomWidth: 0 }]}>
                          <View style={styles.trackInfo}>
                            <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                            <View style={styles.trackStatsRow}>
                              <View style={styles.miniStat}><Ionicons name="play" size={12} color="rgba(255,255,255,0.5)" /><Text style={styles.miniStatTxt}>{track.play_count.toLocaleString()}</Text></View>
                              <View style={styles.miniStat}><Ionicons name="heart" size={12} color="rgba(255,255,255,0.5)" /><Text style={styles.miniStatTxt}>{track.like_count.toLocaleString()}</Text></View>
                            </View>
                          </View>
                          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteTrack(track.id, track.title)}>
                            <Ionicons name="trash" size={18} color="#ff4444" />
                          </TouchableOpacity>
                        </View>
                      ))
                    }
                  </View>
                </View>
              )}

            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },
  backBtn: { padding: 8, marginLeft: -8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,59,48,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff3b30', marginRight: 6 },
  liveText: { color: '#ff3b30', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20, gap: 12 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.02)' },
  tabBtnActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  tabText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#000', fontWeight: '800' },

  content: { paddingHorizontal: 20, paddingBottom: 100 },
  
  heroCard: { padding: 30, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(245, 198, 76, 0.2)', marginBottom: 20, overflow: 'hidden' },
  heroLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '700', marginBottom: 8 },
  heroValue: { color: '#fff', fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  
  chartContainer: { flexDirection: 'row', height: 100, alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 30, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  chartBarWrapper: { width: '6%', height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  chartBar: { width: '100%', borderRadius: 4 },
  chartXLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', marginTop: 12, fontWeight: '600', letterSpacing: 0.5 },

  statsGrid: { flexDirection: 'row', gap: 16 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  statIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(245, 198, 76, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValueSm: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  statLabelSm: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },

  section: { marginTop: 10 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 16, marginLeft: 4, letterSpacing: -0.5 },
  listCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', textAlign: 'center', padding: 30, fontSize: 15 },
  
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.05)' },
  listLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  rank: { color: COLORS.gold, fontSize: 16, fontWeight: '800', width: 28 },
  listName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  listMetric: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  
  trackItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.05)' },
  trackInfo: { flex: 1, paddingRight: 16 },
  trackTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  trackStatsRow: { flexDirection: 'row', gap: 16 },
  miniStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniStatTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  deleteBtn: { padding: 12, backgroundColor: 'rgba(255, 68, 68, 0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 68, 68, 0.2)' }
});
`;

fs.writeFileSync('app/artist/dashboard.tsx', content, 'utf8');
console.log('Artist dashboard rewritten successfully!');
