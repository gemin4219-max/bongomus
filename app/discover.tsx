import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, Animated, Easing, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { Track } from '../constants';
import { useThemeStore } from '../store/themeStore';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../store/playerStore';
import { useAuthStore } from '../store/authStore';
import { GlassView } from '../components/GlassView';
import CommentsModal from '../components/CommentsModal';

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');

const TrackSlide = ({ item, isActive, onListenFull, onComment }: { item: Track, isActive: boolean, onListenFull: () => void, onComment: () => void }) => {
  const { COLORS } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.like_count || 0);
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkLikeStatus();

    // Real-time subscription for live like counts
    const channel = supabase
      .channel(`public:track_likes:${item.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'track_likes', filter: `track_id=eq.${item.id}` },
        (payload) => {
          // If someone else liked the track, increment the counter live
          if (payload.new.user_id !== session?.user?.id) {
            setLikeCount(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'track_likes', filter: `track_id=eq.${item.id}` },
        (payload) => {
          // On delete, we don't always get the user_id in payload.old, 
          // but we can assume if it's realtime, it's safe to decrement if not doing our own action
          // Since our own delete action does optimistic update, this might double decrement briefly
          // But it's acceptable for a live counter to self-correct.
          fetchLikeCount(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [item.id, session]);

  const fetchLikeCount = async () => {
    const { count } = await supabase
      .from('track_likes')
      .select('*', { count: 'exact', head: true })
      .eq('track_id', item.id);
    if (count !== null) setLikeCount(count);
  };

  const checkLikeStatus = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('track_likes')
      .select('id')
      .eq('track_id', item.id)
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (data) setIsLiked(true);
  };

  const handleLike = async () => {
    if (!session?.user?.id) {
      Alert.alert('Sign in', 'You must be signed in to like tracks.');
      return;
    }
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikeCount(prev => newIsLiked ? prev + 1 : Math.max(0, prev - 1));

    if (newIsLiked) {
      await supabase.from('track_likes').insert({ track_id: item.id, user_id: session.user.id });
    } else {
      await supabase.from('track_likes').delete().eq('track_id', item.id).eq('user_id', session.user.id);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Listen to ${item.title} by @${item.profile?.username || 'unknown'} on BongoBox!`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  useEffect(() => {
    let animation: Animated.CompositeAnimation;
    if (isActive) {
      animation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animation.start();
    } else {
      spinValue.setValue(0);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [isActive]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={[styles.slide, { height: WINDOW_HEIGHT }]}>
      <Image 
        source={item.cover_url ? { uri: item.cover_url } : require('../assets/icon.png')} 
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)', '#000']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.contentOverlay, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.infoArea}>
          <GlassView style={styles.previewBadge} intensity={40}>
            <Ionicons name="musical-notes" size={14} color={COLORS.gold} />
            <Text style={styles.previewBadgeText}>15s Preview</Text>
          </GlassView>

          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.artist}>@{item.profile?.username || 'unknown'}</Text>
          
          {item.genre && (
            <View style={styles.genreBadge}>
              <Text style={styles.genreText}>{item.genre}</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.listenFullBtn, { backgroundColor: COLORS.gold }]} onPress={onListenFull}>
            <Ionicons name="play" size={20} color={COLORS.black} />
            <Text style={[styles.listenFullText, { color: COLORS.black }]}>Listen in Full</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsArea}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <View style={styles.iconCircle}>
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={28} color={isLiked ? COLORS.gold : "#fff"} />
            </View>
            <Text style={styles.actionText}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onComment}>
            <View style={styles.iconCircle}>
              <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
            </View>
            <Text style={styles.actionText}>{item.comment_count || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <View style={styles.iconCircle}>
              <Ionicons name="share-social" size={26} color="#fff" />
            </View>
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
          
          <View style={styles.vinylContainer}>
            <Animated.Image 
              source={item.cover_url ? { uri: item.cover_url } : require('../assets/icon.png')} 
              style={[styles.vinylDisc, { transform: [{ rotate: spin }] }]}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

export default function DiscoverScreen() {
  const router = useRouter();
  const { COLORS } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [commentTrackId, setCommentTrackId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const { pause, playTrack, currentTrack } = usePlayerStore();

  useEffect(() => {
    fetchDiscoverTracks();
    return () => {
      stopAudio();
    };
  }, []);

  useEffect(() => {
    if (tracks.length > 0) {
      playAudio(tracks[currentIndex].audio_url);
    }
  }, [currentIndex, tracks]);

  const fetchDiscoverTracks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tracks')
      .select('*, profile:profiles!tracks_user_id_fkey(*)')
      .eq('is_public', true)
      .limit(20);

    if (error) {
      console.error('Error fetching discover tracks:', error);
    } else if (data) {
      const shuffled = data.sort(() => 0.5 - Math.random());
      setTracks(shuffled);
    }
    setLoading(false);
  };

  const stopAudio = async () => {
    const sound = soundRef.current;
    if (sound) {
      soundRef.current = null;
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (e) {
        console.log('Error stopping audio:', e);
      }
    }
  };

  const playAudio = async (url: string) => {
    await stopAudio();
    pause();
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, isLooping: true }
      );
      soundRef.current = sound;
      
      // Stop the preview after 15 seconds automatically
      setTimeout(async () => {
        if (soundRef.current === sound) {
          await sound.stopAsync();
        }
      }, 15000);
    } catch (e) {
      console.log('Error playing preview:', e);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: COLORS.black, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: COLORS.black }]}>
      <FlatList
        data={tracks}
        keyExtractor={(item, index) => item.id + index.toString()}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <TrackSlide 
            item={item} 
            isActive={index === currentIndex} 
            onListenFull={() => {
              stopAudio();
              if (currentTrack?.id !== item.id) {
                playTrack(item, tracks);
              }
              router.push('/player');
            }}
            onComment={() => setCommentTrackId(item.id)}
          />
        )}
      />

      {/* Header Overlay */}
      <GlassView style={[styles.headerOverlay, { paddingTop: insets.top + 10 }]} intensity={20}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => { stopAudio(); router.back(); }}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discover</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => { stopAudio(); router.push('/search'); }}>
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </GlassView>

      {/* Comments Modal */}
      {commentTrackId && (
        <CommentsModal 
          visible={!!commentTrackId}
          trackId={commentTrackId} 
          onClose={() => setCommentTrackId(null)} 
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: { width: WINDOW_WIDTH, justifyContent: 'flex-end' },
  headerOverlay: { position: 'absolute', top: 0, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, zIndex: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  headerBtn: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  contentOverlay: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16 },
  infoArea: { flex: 1, paddingRight: 24 },
  previewBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  previewBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 6 },
  title: { color: '#fff', fontSize: 32, fontWeight: '900', marginBottom: 8, letterSpacing: -0.5 },
  artist: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  genreBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 24 },
  genreText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  listenFullBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, marginTop: 4 },
  listenFullText: { fontSize: 16, fontWeight: '800', marginLeft: 8 },
  actionsArea: { alignItems: 'center', paddingBottom: 10 },
  actionBtn: { alignItems: 'center', marginBottom: 24 },
  iconCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  vinylContainer: { marginTop: 8, padding: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 30 },
  vinylDisc: { width: 44, height: 44, borderRadius: 22, borderWidth: 8, borderColor: '#111' },
});
