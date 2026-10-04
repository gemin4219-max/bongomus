// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

type LiveStation = {
  id: string;
  title: string;
  cover_url: string;
  listener_count: number;
  host_id: string;
  profiles: { display_name: string; username: string };
};

export default function RadioScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore(s => s.profile);
  
  const [stations, setStations] = useState<LiveStation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStations();

    const channel = supabase.channel('public:live_stations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_stations' }, () => {
        fetchStations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStations = async () => {
    const { data, error } = await supabase
      .from('live_stations')
      .select('*, profiles(display_name, username)')
      .eq('status', 'live')
      .order('listener_count', { ascending: false });
      
    if (data) setStations(data as any);
    setLoading(false);
  };

  const handleStartBroadcast = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (!profile) return Alert.alert("Hold on", "You need to log in to start a broadcast.");

    Alert.prompt(
      "Start Live Broadcast",
      "Give your station a catchy name:",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Go Live", 
          onPress: async (title) => {
            if (!title) return;
            const { data, error } = await supabase.from('live_stations').insert({
              host_id: profile.id,
              title,
              cover_url: profile.avatar_url,
              status: 'live'
            }).select().single();
            
            if (error) {
              Alert.alert("Error", "Could not start broadcast.");
            } else {
              router.push(`/station/${data.id}`);
            }
          }
        }
      ]
    );
  };

  const renderStation = ({ item }: { item: LiveStation }) => (
    <TouchableOpacity 
      style={styles.stationCard} 
      activeOpacity={0.8}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        router.push(`/station/${item.id}`);
      }}
    >
      <View style={styles.coverWrapper}>
        {item.cover_url ? (
          <Image source={{ uri: item.cover_url }} style={styles.coverImage} />
        ) : (
          <View style={[styles.coverImage, { backgroundColor: COLORS.cardAlt, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="radio" size={40} color={COLORS.textSecondary} />
          </View>
        )}
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <View style={styles.listenersBadge}>
          <Ionicons name="people" size={12} color="#FFF" />
          <Text style={styles.listenersText}>{item.listener_count}</Text>
        </View>
      </View>
      <View style={styles.stationInfo}>
        <Text style={styles.stationTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.hostName} numberOfLines={1}>Host: {item.profiles?.display_name || item.profiles?.username}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Radio</Text>
        <TouchableOpacity style={styles.goLiveBtn} onPress={handleStartBroadcast}>
          <Ionicons name="radio" size={18} color={COLORS.black} />
          <Text style={styles.goLiveText}>Go Live</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.gold} />
      ) : stations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="planet" size={60} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>It's quiet here...</Text>
          <Text style={styles.emptyDesc}>No one is broadcasting right now. Be the first to start a live session!</Text>
        </View>
      ) : (
        <FlatList
          data={stations}
          keyExtractor={(item) => item.id}
          renderItem={renderStation}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={{ gap: 16 }}
        />
      )}
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  goLiveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.gold, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
  goLiveText: { fontSize: 14, fontWeight: '700', color: COLORS.black },
  
  listContent: { paddingHorizontal: 16, paddingBottom: 100, gap: 16 },
  stationCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden' },
  coverWrapper: { width: '100%', aspectRatio: 1, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  liveBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255, 59, 48, 0.9)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  liveText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  listenersBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  listenersText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  
  stationInfo: { padding: 12 },
  stationTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  hostName: { fontSize: 13, color: COLORS.textSecondary },
  
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginTop: 16 },
  emptyDesc: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
