import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GlassView as BlurView } from '@/components/GlassView';
import { usePlayerStore } from '../store/playerStore';
import { useProgress, usePlaybackState, State } from '../store/playerStore';
import { useRouter } from 'expo-router';

export default function MiniPlayer() {
  const router = useRouter();
  const { currentTrack, togglePlayPause, closePlayer, markPlayCounted, hasCountedPlay } = usePlayerStore();
  const { position, duration } = useProgress();
  const playbackState = usePlaybackState();
  const isPlaying = playbackState.state === State.Playing;

  useEffect(() => {
    if (position >= 30 && !hasCountedPlay && currentTrack) {
      markPlayCounted();
    }
  }, [position, hasCountedPlay, currentTrack]);

  if (!currentTrack) return null;

  const progress = duration > 0 ? position / duration : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push('/player')}
      style={styles.card}
    >
      {/* Album art */}
      {currentTrack.cover_url
        ? <Image source={{ uri: currentTrack.cover_url }} style={styles.cover} transition={200} cachePolicy='memory-disk' />
        : <View style={[styles.cover, styles.coverFallback]}>
            <Ionicons name='musical-note' size={18} color='rgba(255,255,255,0.4)' />
          </View>
      }
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist_name}</Text>
      </View>
      <TouchableOpacity style={styles.ctrlBtn} onPress={(e) => { e?.stopPropagation?.(); togglePlayPause(); }}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color='#fff' />
      </TouchableOpacity>
      <TouchableOpacity style={styles.ctrlBtn} onPress={(e) => { e?.stopPropagation?.(); closePlayer(); }}>
        <Ionicons name='close' size={24} color='rgba(255,255,255,0.7)' />
      </TouchableOpacity>
      <View style={styles.progressTrack} pointerEvents='none'>
        <View style={[styles.progressFill, { width: progress * 100 + '%' }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  cover: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  coverFallback: { justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '600' },
  artist: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
  ctrlBtn: { padding: 6 },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  progressFill: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});