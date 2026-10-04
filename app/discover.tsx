// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, Animated, Easing, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
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
const PREVIEW_SECONDS = 15;
const ART_SIZE = Math.min(WINDOW_WIDTH * 0.72, 320);

// Serve media through the Cloudflare worker (cached at the edge, much faster
// than hitting Supabase storage directly and keeps Supabase egress low)
const toCdn = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  return url
    .replace('gqxdbwnmnqvtdpxnrgtx.supabase.co', 'bongo-cdn.meerkal70.workers.dev')
    .replace(/ /g, '%20');
};

// Big animated CTA shown once the 15s preview finishes
const ListenFullButton = ({ ended, color, textColor, onPress }: { ended: boolean, color: string, textColor: string, onPress: () => void }) => {
  const pop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    if (ended) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start();
      loop = Animated.loop(
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true })
      );
      loop.start();
    } else {
      pop.setValue(0);
      pulse.setValue(0);
    }
    return () => loop?.stop();
  }, [ended]);

  if (!ended) {
    return null;
  }

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
  const breathe = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.05, 1] });

  return (
    <Animated.View style={{ alignSelf: 'flex-start', marginTop: 4, opacity: pop, transform: [{ scale }] }}>
      <Animated.View
        pointerEvents="none"
        style={[styles.ctaRing, { borderColor: color, opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
      />
      <Animated.View style={{ transform: [{ scale: breathe }] }}>
        <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.ctaBtn, { backgroundColor: color, shadowColor: color }]}>
          <View style={[styles.ctaIcon, { backgroundColor: textColor }]}>
            <Ionicons name="play" size={18} color={color} />
          </View>
          <View>
            <Text style={[styles.ctaTitle, { color: textColor }]}>Listen Full Song</Text>
            <Text style={[styles.ctaSub, { color: textColor }]}>Preview ended</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const TrackSlide = ({ item, height, isActive, isLoadingAudio, previewProgress, previewEnded, onReplay, onListenFull, onComment }: { item: Track, height: number, isActive: boolean, isLoadingAudio: boolean, previewProgress: number, previewEnded: boolean, onReplay: () => void, onListenFull: () => void, onComment: () => void }) => {
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

  const coverSource = item.cover_url ? { uri: toCdn(item.cover_url) } : require('../assets/icon.png');

  return (
    <View style={[styles.slide, { height }]}>
      {/* Heavily blurred cover fills the screen instead of a black void */}
      <Image
        source={coverSource}
        placeholder={require('../assets/icon.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={45}
        cachePolicy="memory-disk"
        transition={250}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.75)', '#000']}
        locations={[0, 0.35, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Featured artwork card */}
      <View style={[styles.artWrap, { top: insets.top + 90 }]} pointerEvents="box-none">
        <View style={styles.artShadow}>
          <Image
            source={coverSource}
            placeholder={require('../assets/icon.png')}
            style={styles.artImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={250}
          />
          {isActive && isLoadingAudio && !previewEnded && (
            <View style={styles.artLoading}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
          {isActive && previewEnded && (
            <TouchableOpacity style={styles.artLoading} activeOpacity={0.8} onPress={onReplay}>
              <View style={styles.replayCircle}>
                <Ionicons name="refresh" size={30} color="#fff" />
              </View>
              <Text style={styles.replayText}>Replay preview</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.contentOverlay, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.infoArea}>
          <GlassView style={styles.previewBadge} intensity={40}>
            <Ionicons name={isActive && !isLoadingAudio ? 'volume-high' : 'musical-notes'} size={14} color={COLORS.gold} />
            <Text style={styles.previewBadgeText}>{PREVIEW_SECONDS}s Preview</Text>
          </GlassView>

          {/* Preview progress bar */}
          <View style={styles.previewTrack}>
            <View style={[styles.previewFill, { width: `${Math.round((isActive ? previewProgress : 0) * 100)}%`, backgroundColor: COLORS.gold }]} />
          </View>

          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.artist}>@{item.profile?.username || 'unknown'}</Text>
          
          {item.genre && (
            <View style={styles.genreBadge}>
              <Text style={styles.genreText}>{item.genre}</Text>
            </View>
          )}

          <ListenFullButton
            ended={isActive && previewEnded}
            color={COLORS.gold}
            textColor={COLORS.black}
            onPress={onListenFull}
          />
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
              source={coverSource} 
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
  const { pause, playTrack, currentTrack } = usePlayerStore();
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize with empty source — we'll replace() it when the track changes
  const previewPlayer = useAudioPlayer(null);
  const previewStatus = useAudioPlayerStatus(previewPlayer);
  const previewStartRef = useRef<number>(0);
  const [previewElapsed, setPreviewElapsed] = useState(0);
  // Real height of the list container — using it for paging keeps every swipe
  // landing exactly on one song (WINDOW_HEIGHT can differ and cause drifting)
  const [pageHeight, setPageHeight] = useState(WINDOW_HEIGHT);

  useEffect(() => {
    fetchDiscoverTracks();
    return () => {
      stopAudio();
    };
  }, []);

  // Prefetch covers for the next few slides so they appear instantly
  useEffect(() => {
    const upcoming = tracks
      .slice(currentIndex + 1, currentIndex + 4)
      .map((t) => toCdn(t.cover_url))
      .filter(Boolean) as string[];
    if (upcoming.length) Image.prefetch(upcoming).catch(() => {});
  }, [currentIndex, tracks]);

  // Whenever the active slide changes, load & play the new preview
  useEffect(() => {
    if (tracks.length === 0) return;
    const track = tracks[currentIndex];
    if (!track?.audio_url) return;

    // Clear any previous timer
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setPreviewElapsed(0);

    pause(); // Pause the global player so previews take over

    try {
      // Stream through the CDN — replace() + play() starts as soon as the first bytes arrive
      previewPlayer.replace({ uri: toCdn(track.audio_url)! });
      previewPlayer.play();
      previewStartRef.current = Date.now();
    } catch (e) {
      console.warn('Preview play error:', e);
    }
  }, [currentIndex, tracks]);

  // Count preview time only while audio is actually playing; stop at PREVIEW_SECONDS
  useEffect(() => {
    if (!previewStatus.playing) return;
    const t = setInterval(() => {
      setPreviewElapsed((prev) => {
        const next = prev + 0.25;
        if (next >= PREVIEW_SECONDS) {
          try { previewPlayer.pause(); } catch (_) {}
          return PREVIEW_SECONDS;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(t);
  }, [previewStatus.playing]);

  const isLoadingAudio = !previewStatus.isLoaded || (previewStatus.isBuffering && !previewStatus.playing);
  const previewProgress = Math.min(1, previewElapsed / PREVIEW_SECONDS);
  const previewEnded = previewElapsed >= PREVIEW_SECONDS;

  const replayPreview = () => {
    setPreviewElapsed(0);
    try {
      previewPlayer.seekTo(0);
      previewPlayer.play();
    } catch (_) {}
  };

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

  const stopAudio = () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    try { previewPlayer.pause(); } catch (_) {}
  };

  // Songs only change when the USER swipes — index is derived from where the
  // scroll settles, never advanced automatically.
  const onMomentumScrollEnd = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(tracks.length - 1, Math.round(y / pageHeight)));
    if (idx !== currentIndex) setCurrentIndex(idx);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: '#0B0B10', justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient
          colors={['#1a1206', '#0B0B10', '#000']}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.artSkeleton]} />
        <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 24 }} />
        <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 12, fontWeight: '600' }}>Finding fresh music…</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: COLORS.black }]}
      onLayout={(e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        if (h > 0 && h !== pageHeight) setPageHeight(h);
      }}
    >
      <FlatList
        data={tracks}
        keyExtractor={(item, index) => item.id + index.toString()}
        pagingEnabled
        snapToInterval={pageHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        decelerationRate="fast"
        renderItem={({ item, index }) => (
          <TrackSlide 
            item={item} 
            height={pageHeight}
            isActive={index === currentIndex} 
            isLoadingAudio={index === currentIndex && isLoadingAudio}
            previewProgress={index === currentIndex ? previewProgress : 0}
            previewEnded={index === currentIndex && previewEnded}
            onReplay={replayPreview}
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
  previewTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden', marginBottom: 16, width: '70%' },
  previewFill: { height: '100%', borderRadius: 2 },
  artWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  artShadow: { width: ART_SIZE, height: ART_SIZE, borderRadius: 24, backgroundColor: '#111', shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 20 },
  artImage: { width: '100%', height: '100%', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  artLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  artSkeleton: { width: ART_SIZE, height: ART_SIZE, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  title: { color: '#fff', fontSize: 32, fontWeight: '900', marginBottom: 8, letterSpacing: -0.5 },
  artist: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  genreBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 24 },
  genreText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  listenFullBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, marginTop: 4 },
  listenFullText: { fontSize: 16, fontWeight: '800', marginLeft: 8 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 24, paddingVertical: 8, borderRadius: 34, shadowOpacity: 0.7, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  ctaIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  ctaTitle: { fontSize: 17, fontWeight: '900' },
  ctaSub: { fontSize: 11, fontWeight: '700', opacity: 0.65, marginTop: 1 },
  ctaRing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 34, borderWidth: 2 },
  replayCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  replayText: { color: '#fff', fontWeight: '800', marginTop: 10, fontSize: 14 },
  actionsArea: { alignItems: 'center', paddingBottom: 10 },
  actionBtn: { alignItems: 'center', marginBottom: 24 },
  iconCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  vinylContainer: { marginTop: 8, padding: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 30 },
  vinylDisc: { width: 44, height: 44, borderRadius: 22, borderWidth: 8, borderColor: '#111' },
});
