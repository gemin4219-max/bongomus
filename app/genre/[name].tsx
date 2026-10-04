// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { Track } from '../../constants';
import TrackItem from '../../components/TrackItem';
import { usePlayerStore } from '../../store/playerStore';
import { TouchableOpacity } from 'react-native-gesture-handler';

export default function GenreScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const { name } = useLocalSearchParams();
  const router = useRouter();
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (name) loadData();
  }, [name]);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('genre', name).eq('is_public', true).order('play_count', { ascending: false });
    if (data) setTracks(data as Track[]);
    setLoading(false);
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={COLORS.gold} size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{name}</Text>
        <View style={{ width: 44 }} />
      </View>
      
      <FlatList showsVerticalScrollIndicator={false}
        data={tracks}
        keyExtractor={t => t.id}
        renderItem={({ item }) => (
          <TrackItem
            track={item}
            isPlaying={currentTrack?.id === item.id}
            onPress={() => playTrack(item, tracks)}
            onArtistPress={() => router.push({ pathname: '/artist/[id]', params: { id: item.user_id } })}
          />
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 20 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
