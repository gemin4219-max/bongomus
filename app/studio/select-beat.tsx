// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Track } from '../../constants';
import { useThemeStore } from '../../store/themeStore';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassBackButton from '../../components/GlassBackButton';

export default function SelectBeatScreen() {
  const router = useRouter();
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const insets = useSafeAreaInsets();
  const [beats, setBeats] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBeats();
  }, []);

  const fetchBeats = async () => {
    setLoading(true);
    // Fetch tracks that could be used as beats. For now, fetch all public tracks as an example.
    const { data, error } = await supabase
      .from('tracks')
      .select('*, profile:profiles(*)')
      .eq('is_public', true)
      .limit(50);

    if (data) {
      setBeats(data);
    }
    setLoading(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <GlassBackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Select a Beat</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={beats}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No beats found.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.trackCard}
              onPress={() => router.push({ pathname: '/studio/record', params: { beatId: item.id, beatUrl: item.audio_url, beatTitle: item.title } })}
            >
              <Image source={item.cover_url ? { uri: item.cover_url } : require('../../assets/icon.png')} style={styles.cover} />
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle}>{item.title}</Text>
                <Text style={styles.trackArtist}>{item.profile?.display_name || 'Unknown'}</Text>
              </View>
              <Ionicons name="mic-outline" size={24} color={COLORS.gold} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 },
  trackCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardAlt, padding: 12, borderRadius: 12, marginBottom: 12 },
  cover: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  trackInfo: { flex: 1 },
  trackTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  trackArtist: { color: COLORS.textSecondary, fontSize: 13 },
});
