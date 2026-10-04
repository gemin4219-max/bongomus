// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView as BlurView } from '@/components/GlassView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { Track } from '../../constants';
import TrackItem from '../../components/TrackItem';
import CollaboratorModal from '../../components/CollaboratorModal';
import EditPlaylistModal from '../../components/EditPlaylistModal';
import { usePlayerStore } from '../../store/playerStore';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');

export default function PlaylistScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const session = useAuthStore(s => s.session);

  const [playlist, setPlaylist] = useState<any>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [colabModalVisible, setColabModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    
    // Fetch Playlist
    const { data: playlistData } = await supabase.from('playlists').select('*, profile:profiles!playlists_user_id_fkey(*)').eq('id', id).single();
    if (playlistData) setPlaylist(playlistData);

    // Fetch Tracks
    const { data: pTracks } = await supabase.from('playlist_tracks').select('track_id').eq('playlist_id', id);
    if (pTracks && pTracks.length > 0) {
      const trackIds = pTracks.map(pt => pt.track_id);
      const { data: trackData } = await supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').in('id', trackIds);
      if (trackData) setTracks(trackData as Track[]);
    }

    // Fetch Collaborators
    const { data: colabs } = await supabase.from('playlist_collaborators').select('*, profile:profiles!playlist_collaborators_user_id_fkey(*)').eq('playlist_id', id);
    if (colabs) setCollaborators(colabs);

    setLoading(false);
  };

  const inviteCollaborator = () => {
    setColabModalVisible(true);
  };

  const togglePrivacy = async () => {
    if (session?.user.id !== playlist.user_id) return;
    const newStatus = !playlist.is_public;
    setPlaylist({ ...playlist, is_public: newStatus });
    await supabase.from('playlists').update({ is_public: newStatus }).eq('id', id);
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={COLORS.gold} size="large" /></View>;
  if (!playlist) return <View style={styles.loader}><Text style={{color: '#fff'}}>Playlist not found</Text></View>;

  const isOwner = session?.user.id === playlist.user_id;

  const headerHeight = 350;
  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0, headerHeight],
    outputRange: [1.5, 1, 1],
    extrapolate: 'clamp',
  });
  
  const imageTranslateY = scrollY.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, -headerHeight / 2],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [headerHeight - 100, headerHeight],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      {/* Parallax Header Image */}
      <Animated.View style={[styles.parallaxHeader, { transform: [{ scale: imageScale }, { translateY: imageTranslateY }] }]}>
        {playlist.cover_url ? (
          <Image source={{ uri: playlist.cover_url }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <View style={{ width: '100%', height: '100%', backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="musical-notes" size={100} color={COLORS.textTertiary} />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(10,10,15,0.8)', '#0A0A0F']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Sticky Top Nav */}
      <Animated.View style={[styles.stickyNav, { opacity: headerOpacity }]}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <Text style={styles.stickyNavTitle} numberOfLines={1}>{playlist.title}</Text>
      </Animated.View>

      {/* Back Button (Always Visible) */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <BlurView intensity={40} tint="dark" style={styles.iconBtnBlur}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </BlurView>
      </TouchableOpacity>

      <Animated.FlatList 
        showsVerticalScrollIndicator={false}
        data={tracks}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingTop: headerHeight - 100, paddingBottom: 160 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={styles.profileHeader}>
            <Text style={styles.name}>{playlist.title}</Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Text style={styles.stats}>Playlist by <Text style={{ color: '#fff' }}>{playlist.profile?.display_name || 'Unknown'}</Text></Text>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.textTertiary }} />
              <Text style={styles.stats}>{tracks.length} tracks</Text>
            </View>

            {/* Action Row */}
            <View style={styles.actionRow}>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity onPress={togglePrivacy} disabled={!isOwner}>
                  <Ionicons name={playlist.is_public ? "globe-outline" : "lock-closed-outline"} size={28} color={COLORS.textSecondary} />
                </TouchableOpacity>
                {isOwner && (
                  <TouchableOpacity onPress={() => setEditModalVisible(true)}>
                    <Ionicons name="ellipsis-horizontal-circle" size={28} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={inviteCollaborator}>
                  <Ionicons name="person-add-outline" size={26} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <TouchableOpacity>
                  <Ionicons name="shuffle" size={32} color="#1DB954" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.playButtonFab} onPress={() => { if(tracks.length > 0) playTrack(tracks[0], tracks) }}>
                  <Ionicons name="play" size={28} color="#000" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <TrackItem
              track={item}
              isPlaying={currentTrack?.id === item.id}
              onPress={() => playTrack(item, tracks)}
            />
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Ionicons name="musical-notes" size={48} color={COLORS.textTertiary} />
            <Text style={{ color: COLORS.textSecondary, marginTop: 16 }}>No tracks added yet.</Text>
          </View>
        )}
      />
      
      <CollaboratorModal 
        visible={colabModalVisible} 
        onClose={() => {
          setColabModalVisible(false);
          loadData(); // Refresh collaborators list when modal closes
        }} 
        playlistId={id as string} 
      />

      {playlist && (
        <EditPlaylistModal
          visible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
          playlistId={id as string}
          initialTitle={playlist.title}
          initialDescription={playlist.description}
          initialCoverUrl={playlist.cover_url}
          onUpdated={loadData}
        />
      )}
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0F' },
  parallaxHeader: { position: 'absolute', top: 0, left: 0, right: 0, height: 350 },
  stickyNav: { position: 'absolute', top: 0, left: 0, right: 0, height: Platform.OS === 'ios' ? 100 : 80, zIndex: 10, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 16 },
  stickyNavTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backButton: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 16, zIndex: 20 },
  iconBtnBlur: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  profileHeader: { paddingHorizontal: 16, paddingBottom: 24 },
  name: { color: '#fff', fontSize: 42, fontWeight: '900', marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  stats: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 },
  playButtonFab: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1DB954', justifyContent: 'center', alignItems: 'center', shadowColor: '#1DB954', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
});
