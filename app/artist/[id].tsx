import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView as BlurView } from '@/components/GlassView';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { Track } from '../../constants';
import { usePlayerStore } from '../../store/playerStore';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');

export default function ArtistScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const session = useAuthStore(s => s.session);

  const [artist, setArtist] = useState<any>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    const [artistRes, tracksRes, followRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('user_id', id).eq('is_public', true).order('play_count', { ascending: false }),
      session ? supabase.from('follows').select('*').eq('follower_id', session.user.id).eq('following_id', id) : Promise.resolve({ data: null })
    ]);
    
    if (artistRes.data) setArtist(artistRes.data);
    if (tracksRes.data) setTracks(tracksRes.data as Track[]);
    if (followRes.data && followRes.data.length > 0) setIsFollowing(true);
    
    setLoading(false);
  };

  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`artist-tracks-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tracks', filter: `user_id=eq.${id}` }, (payload) => {
        setTracks(prev => prev.map(t => t.id === payload.new.id ? { ...t, play_count: payload.new.play_count } : t));
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const toggleFollow = async () => {
    if (!session) {
      useAuthStore.getState().disableOfflineMode();
      router.push('/auth');
      return;
    }
    const previousState = isFollowing;
    setIsFollowing(!isFollowing); 
    
    try {
      if (previousState) {
        await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', id);
        setArtist((prev: any) => ({ ...prev, follower_count: Math.max(0, (prev.follower_count || 0) - 1) }));
      } else {
        await supabase.from('follows').insert({ follower_id: session.user.id, following_id: id });
        setArtist((prev: any) => ({ ...prev, follower_count: (prev.follower_count || 0) + 1 }));
      }
    } catch (e) {
      console.error(e);
      setIsFollowing(previousState);
    }
  };

  const playArtist = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color="#1DB954" size="large" /></View>;
  if (!artist) return <View style={styles.loader}><Text style={{color: '#fff'}}>Artist not found</Text></View>;

  const headerHeight = width * 1.1;

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
    inputRange: [headerHeight - 120, headerHeight - 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* Parallax Hero Image */}
      <Animated.View style={[styles.parallaxHeader, { height: headerHeight, transform: [{ scale: imageScale }, { translateY: imageTranslateY }] }]}>
        {artist.avatar_url ? (
          <Image source={{ uri: artist.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#333' }]} />
        )}
        <LinearGradient 
          colors={['transparent', 'rgba(0,0,0,0.6)', COLORS.black]} 
          locations={[0.3, 0.7, 1]} 
          style={StyleSheet.absoluteFill} 
        />
      </Animated.View>

      {/* Sticky Top Nav */}
      <Animated.View style={[styles.stickyNav, { opacity: headerOpacity }]}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <Text style={styles.stickyNavTitle} numberOfLines={1}>{artist.display_name}</Text>
      </Animated.View>

      {/* Absolute Back Button */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <BlurView intensity={40} tint="dark" style={styles.iconBtnBlur}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </BlurView>
      </TouchableOpacity>

      <Animated.FlatList 
        showsVerticalScrollIndicator={false}
        data={tracks}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingTop: headerHeight - 140, paddingBottom: 160 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View>
            <View style={styles.heroContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {artist.is_verified && <Ionicons name="checkmark-circle" size={24} color="#1DB954" />}
                {artist.is_verified && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Verified Artist</Text>}
              </View>
              <Text style={styles.heroName} numberOfLines={2}>{artist.display_name}</Text>
            </View>

            <View style={styles.contentPadding}>
              <Text style={styles.listenersText}>{tracks.reduce((sum, t) => sum + (t.play_count || 0), 0).toLocaleString()} monthly listeners</Text>
              
              {/* Action Row */}
              <View style={styles.actionRow}>
                <View style={styles.actionLeft}>
                  <TouchableOpacity style={styles.followBtn} onPress={toggleFollow}>
                    <Text style={styles.followBtnText}>{isFollowing ? 'Following' : 'Follow'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ padding: 8 }}>
                    <Ionicons name="ellipsis-vertical" size={22} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.actionRight}>
                  <TouchableOpacity style={{ padding: 8 }}>
                    <Ionicons name="shuffle" size={32} color="#1DB954" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.playBtn} activeOpacity={0.8} onPress={playArtist}>
                    <Ionicons name="play" size={28} color="#000" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.popularTitle}>Popular</Text>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.trackRow} onPress={() => playTrack(item, tracks)}>
            <Text style={styles.trackIndex}>{index + 1}</Text>
            <Image source={{ uri: item.cover_url || artist.avatar_url }} style={styles.trackCover} contentFit="cover" />
            <View style={styles.trackInfo}>
              <Text style={[styles.trackTitle, currentTrack?.id === item.id && { color: '#1DB954' }]} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.trackSubRow}>
                {item.is_explicit && (
                  <View style={styles.explicitBadge}>
                    <Text style={styles.explicitText}>E</Text>
                  </View>
                )}
                <Text style={styles.trackPlays}>
                  {(item.play_count || 0).toLocaleString()}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={{ padding: 8 }}>
              <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.black },
  
  parallaxHeader: { position: 'absolute', top: 0, left: 0, right: 0 },
  stickyNav: { position: 'absolute', top: 0, left: 0, right: 0, height: Platform.OS === 'ios' ? 100 : 80, zIndex: 10, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 16 },
  stickyNavTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  backButton: { 
    position: 'absolute', 
    top: Platform.OS === 'ios' ? 50 : 30, 
    left: 16, 
    zIndex: 20
  },
  iconBtnBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center'
  },

  heroContainer: { 
    width: '100%', 
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16
  },
  heroName: { 
    color: '#FFF', 
    fontSize: 64, 
    fontWeight: '900', 
    letterSpacing: -2,
    lineHeight: 70,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10
  },

  contentPadding: { paddingHorizontal: 16 },
  listenersText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500', marginBottom: 12 },
  
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  
  followBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 6, 
    borderRadius: 4, 
    borderWidth: 1, 
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  followBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  playBtn: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: '#1DB954', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  popularTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 16 },
  
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  trackIndex: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600', width: 28, textAlign: 'center', marginRight: 12 },
  trackCover: { width: 48, height: 48, borderRadius: 2, marginRight: 12, backgroundColor: '#333' },
  trackInfo: { flex: 1, justifyContent: 'center' },
  trackTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  trackSubRow: { flexDirection: 'row', alignItems: 'center' },
  explicitBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 4, borderRadius: 2, marginRight: 6 },
  explicitText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  trackPlays: { color: COLORS.textSecondary, fontSize: 14 },
});
