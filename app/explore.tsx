// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';
import { usePlayerStore } from '../store/playerStore';
import { useAIStore } from '../store/aiStore';
import { Track } from '../constants';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

// Pager item width: we want it slightly smaller than full width so next item peeks
const ITEM_WIDTH = width * 0.85;
const ITEM_SPACING = (width - ITEM_WIDTH) / 2;

export default function ExploreScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const setRemixData = useAIStore(s => s.setRemixData);
  
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedTracks, setLikedTracks] = useState<Record<string, boolean>>({});
  const flatListRef = useRef<FlatList>(null);

  const { playTrack, currentTrack, isPlaying, togglePlayPause, positionMs, durationMs, skipNext, skipPrev } = usePlayerStore();

  useEffect(() => {
    loadExploreData();
  }, []);

  const loadExploreData = async () => {
    try {
      const { data, error } = await supabase
        .from('tracks')
        .select('*, profile:profiles!tracks_user_id_fkey(*)')
        .eq('is_public', true)
        .order('play_count', { ascending: false }) // Trending for explore
        .limit(50);
        
      if (data) {
        // Shuffle the data for variety
        const shuffled = [...data].sort(() => 0.5 - Math.random());
        setTracks(shuffled as Track[]);
      }
    } catch (e) {
      console.log('Explore err', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    const activeTrack = tracks[currentIndex];
    if (!activeTrack) return;
    
    const trackId = activeTrack.id;
    const isLiked = !!likedTracks[trackId];
    
    // Optimistic UI
    setLikedTracks(prev => ({ ...prev, [trackId]: !isLiked }));
    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        return { ...t, like_count: (t.like_count || 0) + (isLiked ? -1 : 1) };
      }
      return t;
    }));

    // Server Update
    try {
      const { data, error } = await supabase.rpc('toggle_track_like', { p_track_id: trackId });
      if (error) throw error;
      if (data !== null) {
        setLikedTracks(prev => ({ ...prev, [trackId]: data }));
      }
    } catch (e) {
      console.log('Error toggling like:', e);
      // Revert on error
      setLikedTracks(prev => ({ ...prev, [trackId]: isLiked }));
      setTracks(prev => prev.map(t => {
        if (t.id === trackId) {
          return { ...t, like_count: (t.like_count || 0) + (isLiked ? 1 : -1) };
        }
        return t;
      }));
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== currentIndex && tracks[newIndex]) {
        setCurrentIndex(newIndex);
        
        // If the user manually swiped to a new song and it's not currently playing, play it!
        if (currentTrack?.id !== tracks[newIndex].id) {
          playTrack(tracks[newIndex], tracks);
          Haptics.selectionAsync();
        }
      }
    }
  }).current;

  // Sync FlatList scroll position if the song changes externally (e.g. auto-play next)
  useEffect(() => {
    if (currentTrack && tracks.length > 0) {
      const trackIndex = tracks.findIndex(t => t.id === currentTrack.id);
      if (trackIndex !== -1 && trackIndex !== currentIndex) {
        setCurrentIndex(trackIndex);
        flatListRef.current?.scrollToIndex({ index: trackIndex, animated: true });
      }
    }
  }, [currentTrack?.id, tracks.length]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  const formatTime = (ms: number) => {
    if (!ms || isNaN(ms)) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  // Check if current track is the one we are looking at (to sync UI)
  const activeTrack = tracks[currentIndex];
  const isThisTrackPlaying = currentTrack?.id === activeTrack?.id && isPlaying;

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient colors={['#3B2F2F', '#1A1515', '#0A0A0F']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Album Art Carousel */}
        <View style={styles.carouselContainer}>
          <FlatList
            ref={flatListRef}
            data={tracks}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={width}
            decelerationRate="fast"
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item, index }) => (
              <View style={{ width, alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                <Image 
                  source={{ uri: item.cover_url || undefined }} 
                  style={[styles.albumCover, currentTrack?.id === item.id ? styles.activeCover : null]} 
                  contentFit="cover"
                  transition={200}
                />
              </View>
            )}
          />
        </View>

        {activeTrack && (
          <ScrollView style={styles.contentContainer} contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
            {/* Title Row */}
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.songTitle} numberOfLines={1}>{activeTrack.title}</Text>
                <Text style={styles.songArtist} numberOfLines={1}>{activeTrack.artist_name}</Text>
              </View>
              <TouchableOpacity style={styles.iconBtn}>
                <Ionicons name="share-outline" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn}>
                <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Actions Row */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionPill} onPress={handleLike}>
                <Ionicons name={likedTracks[activeTrack.id] ? "heart" : "heart-outline"} size={18} color={likedTracks[activeTrack.id] ? "#ff3b6a" : "#fff"} />
                <Text style={styles.actionText}>{activeTrack.like_count || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionPill}>
                <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                <Text style={styles.actionText}>{activeTrack.comment_count || 0}</Text>
              </TouchableOpacity>
              {activeTrack.is_ai && (
                <TouchableOpacity style={styles.actionPill} onPress={() => {
                  console.log("Remix clicked! Setting data and navigating to AI Studio...");
                  setRemixData({
                    audioUrl: activeTrack.audio_url,
                    title: activeTrack.title,
                    prompt: '',
                    tags: ''
                  });
                  // Try routing directly to the tab name
                  router.push('/ai-studio');
                }}>
                  <Ionicons name="sync-outline" size={18} color="#fff" />
                  <Text style={styles.actionText}>Remix</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.actionIconOnly}>
                <Ionicons name="add-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressWrap}>
              <View style={styles.fakeSliderBg}>
                <View style={[styles.fakeSliderFill, { width: `${Math.min(100, (positionMs / (durationMs || 1)) * 100)}%` }]} />
                <View style={[styles.fakeSliderThumb, { left: `${Math.min(100, (positionMs / (durationMs || 1)) * 100)}%` }]} />
              </View>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
                <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
              </View>
            </View>

            {/* Player Controls */}
            <View style={styles.controlsWrap}>
              <TouchableOpacity style={styles.ctrlBtn}>
                <Ionicons name="shuffle" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn} onPress={skipPrev}>
                <Ionicons name="play-skip-back" size={32} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.playBtn} onPress={() => {
                if (currentTrack?.id === activeTrack.id) {
                  togglePlayPause();
                } else {
                  playTrack(activeTrack, tracks);
                }
              }}>
                <Ionicons name={isThisTrackPlaying ? "pause" : "play"} size={36} color="#000" style={{ marginLeft: isThisTrackPlaying ? 0 : 4 }} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn} onPress={skipNext}>
                <Ionicons name="play-skip-forward" size={32} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn}>
                <Ionicons name="repeat" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* About Artist Card */}
            <View style={styles.aboutCard}>
              <View style={styles.aboutInner}>
                <View style={styles.aboutAvatarWrap}>
                  <Image source={{ uri: activeTrack.profile?.avatar_url || undefined }} style={styles.aboutAvatar} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.aboutName}>{activeTrack.artist_name}</Text>
                    <Ionicons name="checkmark-circle" size={14} color="#ff3b6a" />
                  </View>
                  <Text style={styles.aboutStats}>{activeTrack.profile?.followers_count || 0} Followers · {activeTrack.profile?.track_count || 0} Songs</Text>
                </View>
                <TouchableOpacity style={styles.followBtn}>
                  <Text style={styles.followText}>Follow</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* About this song Card */}
            <View style={[styles.aboutCard, { marginTop: 12, padding: 16 }]}>
              <Text style={[styles.aboutName, { marginBottom: 12 }]}>About this song</Text>
              
              {activeTrack.description && (
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 22, marginBottom: 12 }}>
                  {activeTrack.description}
                </Text>
              )}
              
              {activeTrack.is_ai && activeTrack.ai_prompt && (
                <>
                  <Text style={{ color: '#ff3b6a', fontSize: 12, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' }}>Prompt Used</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 22, marginBottom: 12 }}>
                    "{activeTrack.ai_prompt}"
                  </Text>
                </>
              )}
              
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 16 }}>
                Created on {new Date(activeTrack.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>

              {/* View Hooks Button (Mock) */}
              <TouchableOpacity style={styles.hooksBtn}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Image source={{ uri: activeTrack.cover_url || undefined }} style={{ width: 24, height: 24, borderRadius: 4 }} />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>View Hooks</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            {/* Lyrics Card */}
            {(activeTrack.lyrics || activeTrack.is_ai) && (
              <View style={[styles.aboutCard, { marginTop: 12, padding: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={styles.aboutName}>Lyrics</Text>
                  <TouchableOpacity style={styles.actionIconOnly}>
                    <Ionicons name="copy-outline" size={18} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                </View>
                
                <Text style={{ color: '#fff', fontSize: 16, lineHeight: 28, fontWeight: '500' }}>
                  {activeTrack.lyrics || "No lyrics available for this track."}
                </Text>
              </View>
            )}

          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  carouselContainer: {
    height: width * 0.9,
  },
  albumCover: {
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  activeCover: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  songTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  songArtist: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '500',
  },
  iconBtn: {
    padding: 8,
    marginLeft: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  actionIconOnly: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 6,
    borderRadius: 20,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressWrap: {
    marginBottom: 20,
  },
  fakeSliderBg: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginBottom: 8,
    position: 'relative',
    justifyContent: 'center',
  },
  fakeSliderFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  fakeSliderThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginLeft: -6,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginTop: -10,
  },
  timeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  controlsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  ctrlBtn: {
    padding: 8,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 12,
  },
  aboutInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aboutAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginRight: 12,
    overflow: 'hidden',
  },
  aboutAvatar: {
    width: '100%',
    height: '100%',
  },
  aboutName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  aboutStats: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  followBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13,
  },
  hooksBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
  },
});
