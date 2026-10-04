// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { Image } from 'expo-image';

export default function RoomsScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);

  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRooms();
    
    // Subscribe to changes in rooms
    const subscription = supabase
      .channel('public:rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, payload => {
        loadRooms();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const loadRooms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rooms')
      .select('*, artist:profiles!artist_id(*), track:tracks!track_id(*)')
      .neq('status', 'finished')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setRooms(data || []);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Live Parties',
          headerStyle: { backgroundColor: COLORS.darkSurface },
          headerTintColor: COLORS.textPrimary,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 20 }}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          )
        }} 
      />

      {loading && rooms.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListHeaderComponent={
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: COLORS.textPrimary, fontSize: 24, fontWeight: '800' }}>Listening Parties</Text>
              <Text style={{ color: COLORS.textSecondary, marginTop: 4 }}>Join artists as they drop new hits live!</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="mic-outline" size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyTitle}>No Live Parties</Text>
              <Text style={styles.emptySub}>There are no listening parties happening right now. Check back later!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.roomCard}
              onPress={() => router.push(`/rooms/${item.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.roomHeader}>
                <View style={[styles.statusBadge, item.status === 'live' ? styles.statusLive : styles.statusWaiting]}>
                  {item.status === 'live' && <View style={styles.pulseDot} />}
                  <Text style={styles.statusText}>{item.status === 'live' ? 'LIVE NOW' : 'STARTING SOON'}</Text>
                </View>
                <View style={styles.listenerCount}>
                  <Ionicons name="people" size={14} color={COLORS.textSecondary} />
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginLeft: 4, fontWeight: '700' }}>{item.listener_count}</Text>
                </View>
              </View>

              <View style={styles.roomInfo}>
                <Image source={{ uri: item.track?.cover_url || item.artist?.avatar_url || undefined }} style={styles.roomImage} transition={200} />
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={styles.roomTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.roomArtist} numberOfLines={1}>Hosted by {item.artist?.display_name}</Text>
                  <Text style={styles.roomTrack} numberOfLines={1}>🎵 {item.track?.title}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 16 },
  emptySub: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 },
  roomCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.divider },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusLive: { backgroundColor: 'rgba(255, 59, 48, 0.2)' },
  statusWaiting: { backgroundColor: 'rgba(255, 204, 0, 0.2)' },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: COLORS.textPrimary },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30', marginRight: 6 },
  listenerCount: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardAlt, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  roomInfo: { flexDirection: 'row', alignItems: 'center' },
  roomImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: COLORS.cardAlt },
  roomTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  roomArtist: { color: COLORS.gold, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  roomTrack: { color: COLORS.textSecondary, fontSize: 13 },
});
