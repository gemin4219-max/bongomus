import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Switch, Animated, PanResponder, Dimensions, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useAIStore } from '../store/aiStore';
import { useAuthStore } from '../store/authStore';
import { extendAudio, getTaskInfo } from '../lib/sunoApi';
import { usePlayerStore, usePlaybackState, State } from '../store/playerStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WAVEFORM_WIDTH = SCREEN_WIDTH - 40;
const MARKER_WIDTH = 36;

function buildWaveform(seed: string, count = 80): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: count }, (_, i) => {
    h = (h * 1664525 + 1013904223) >>> 0;
    const base = 0.15 + (h % 1000) / 1000 * 0.85;
    const taper = Math.min(i / 6, 1) * Math.min((count - i) / 6, 1);
    return base * taper;
  });
}

interface ExtendSongModalProps {
  visible: boolean;
  onClose: () => void;
  songTask: any;
}

export const ExtendSongModal: React.FC<ExtendSongModalProps> = ({ visible, onClose, songTask }) => {
  const track = songTask?.tracks?.[0] || songTask;
  const duration = track?.duration || track?.duration_sec || 0;
  
  const maxMarkerX = Math.max(0, WAVEFORM_WIDTH - MARKER_WIDTH);
  const [markerXAnimated] = useState(new Animated.Value(maxMarkerX));
  const [markerX, setMarkerX] = useState(maxMarkerX);
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  
  const { profile } = useAuthStore();
  const { addTask, updateTask } = useAIStore();
  const { playTrack, pauseTrack, currentTrack, playerState } = usePlayerStore();
  
  const isPlaying = currentTrack?.id === track?.id && playerState === State.Playing;

  const waveform = useMemo(() => buildWaveform(track?.id || 'default'), [track?.id]);

  useEffect(() => {
    const listenerId = markerXAnimated.addListener(({ value }) => {
      setMarkerX(value);
    });
    return () => { markerXAnimated.removeListener(listenerId); };
  }, [markerXAnimated]);

  useEffect(() => {
    if (visible) {
      markerXAnimated.setValue(maxMarkerX);
    }
  }, [visible, maxMarkerX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: markerXAnimated }], {
        useNativeDriver: false,
        listener: (e, gestureState) => {
          let newX = maxMarkerX + gestureState.dx;
          if (newX < 0) newX = 0;
          if (newX > maxMarkerX) newX = maxMarkerX;
          markerXAnimated.setValue(newX);
        },
      }),
      onPanResponderRelease: () => {
        markerXAnimated.extractOffset();
      },
    })
  ).current;

  const extendFromSec = duration > 0 ? (markerX / maxMarkerX) * duration : 0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlayToggle = async () => {
    if (isPlaying) {
      await pauseTrack();
    } else {
      await playTrack(track);
    }
  };

  const handleExtend = async () => {
    if (!track?.id) {
      Alert.alert('Error', 'Invalid track selected.');
      return;
    }
    setIsExtending(true);
    try {
      // extendAudio(audioId, prompt, continueAt) — positional args
      const taskId = await extendAudio(
        track.id,
        isInstrumental ? '' : (track.lyrics || track.prompt || ''),
        Math.floor(extendFromSec),
      );

      addTask(taskId, `Extending: ${track.title || 'Untitled'}`, 'GENERATE');
      updateTask(taskId, 'PROCESSING');
      onClose();

      const pollInterval = setInterval(async () => {
        try {
          const taskInfo = await getTaskInfo(taskId);
          const status = taskInfo?.status?.toUpperCase?.() ?? '';

          if (status === 'SUCCESS') {
            const newTrack = taskInfo.data?.[0];
            updateTask(taskId, 'SUCCESS', taskInfo.data || []);
            clearInterval(pollInterval);

            if (newTrack && profile?.id) {
              await supabase.from('tracks').insert({
                user_id: profile.id,
                title: newTrack.title || `Extension of ${track.title}`,
                artist_name: profile.username || 'BongoBox Creator',
                genre: track.genre || track.tags || 'AI Generated',
                audio_url: newTrack.audioUrl || newTrack.audio_url,
                cover_url: newTrack.imageUrl || newTrack.image_url || track.imageUrl || track.cover_url,
                duration_sec: newTrack.duration || 0,
                lyrics: newTrack.lyrics || track.lyrics || null,
                is_public: false,
              });
            }
          } else if (status === 'FAILED' || status === 'SENSITIVE_WORD_ERROR') {
            updateTask(taskId, 'FAILED');
            clearInterval(pollInterval);
          }
          // PENDING / PROCESSING — keep polling
        } catch (e) {
          console.error('Extend polling error:', e);
        }
      }, 5000);

    } catch (e: any) {
      console.error(e);
      Alert.alert('Extension Failed', e.message || 'Something went wrong. Please try again.');
    } finally {
      setIsExtending(false);
    }
  };

  const coverImage = track?.imageUrl || track?.cover_url || 'https://picsum.photos/60';
  const songTitle = track?.title || 'Untitled';
  const artistName = profile?.username || 'BongoBox Creator';
  const durationStr = duration > 0 ? formatTime(duration) : '--:--';
  const lyrics = track?.lyrics || track?.prompt || '';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerIconBtn} />
          <View style={styles.headerCenter}>
            <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.headerTitle}>Extend</Text>
          </View>
          <TouchableOpacity style={styles.headerIconBtn} onPress={onClose}>
            <Ionicons name="chevron-down" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.songCard}>
            <Image source={{ uri: coverImage }} style={styles.songThumb} />
            <View style={styles.songInfo}>
              <Text style={styles.songTitle} numberOfLines={1}>{songTitle}</Text>
              <View style={styles.songArtistRow}>
                <View style={styles.avatarDot} />
                <Text style={styles.songArtist}>{artistName}</Text>
              </View>
            </View>
            <Text style={styles.songDuration}>{durationStr}</Text>
          </View>

          <View style={styles.waveformContainer}>
            <View style={styles.waveformBars}>
              {waveform.map((amp, i) => (
                <View
                  key={i}
                  style={[styles.waveBar, { height: Math.max(3, amp * 62) }]}
                />
              ))}
              <Animated.View
                style={[styles.marker, { left: markerX }]}
                {...panResponder.panHandlers}
              >
                <View style={styles.markerLine} />
              </Animated.View>
            </View>
          </View>

          <View style={styles.playRow}>
            <TouchableOpacity style={styles.playBtn} onPress={handlePlayToggle}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.extendFromBlock}>
              <Text style={styles.extendFromLabel}>extend from</Text>
              <Text style={styles.extendFromTime}>{formatTime(extendFromSec)}</Text>
            </View>
          </View>

          <View style={styles.lyricsSection}>
            <View style={styles.lyricsSectionHeader}>
              <Text style={styles.lyricsSectionTitle}>Lyrics</Text>
              <View style={styles.instrumentalRow}>
                <Text style={styles.instrumentalLabel}>Instrumental</Text>
                <Switch
                  value={isInstrumental}
                  onValueChange={setIsInstrumental}
                  trackColor={{ false: '#444', true: '#FF2A75' }}
                  thumbColor="#FFF"
                />
              </View>
            </View>
            <View style={styles.lyricsBox}>
              {lyrics && !isInstrumental ? (
                lyrics.split('\n').map((line: string, i: number) => (
                  <Text key={i} style={[styles.lyricLine, line.startsWith('[') && line.endsWith(']') && styles.lyricSection]}>
                    {line || ' '}
                  </Text>
                ))
              ) : (
                <Text style={styles.lyricPlaceholder}>
                  {isInstrumental ? 'Instrumental extension - no lyrics' : 'No lyrics saved for this song'}
                </Text>
              )}
            </View>
          </View>
          <View style={{ height: 130 }} />
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.extendBtn} onPress={handleExtend} disabled={isExtending} activeOpacity={0.85}>
            <LinearGradient
              colors={['#FF2A75', '#FF8C00']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.extendBtnGradient}
            >
              {isExtending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.extendBtnText}>Extend</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  headerIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  scroll: { flex: 1 },
  songCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#181818', marginHorizontal: 16, borderRadius: 12, padding: 12, marginBottom: 20 },
  songThumb: { width: 52, height: 52, borderRadius: 8 },
  songInfo: { flex: 1, marginLeft: 12 },
  songTitle: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  songArtistRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  avatarDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FF8C00', marginRight: 6 },
  songArtist: { color: '#AAA', fontSize: 13 },
  songDuration: { color: '#AAA', fontSize: 13, marginLeft: 12 },
  waveformContainer: { marginHorizontal: 20, height: 80, backgroundColor: '#181818', borderRadius: 10, overflow: 'hidden', justifyContent: 'center' },
  waveformBars: { flexDirection: 'row', alignItems: 'center', height: 80, paddingHorizontal: 4, position: 'relative' },
  waveBar: { flex: 1, marginHorizontal: 0.8, borderRadius: 2, backgroundColor: '#888' },
  marker: { position: 'absolute', top: 0, bottom: 0, width: MARKER_WIDTH, backgroundColor: 'rgba(180,40,80,0.88)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  markerLine: { width: 3, height: 36, backgroundColor: '#FFF', borderRadius: 2 },
  playRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 14, marginBottom: 24 },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  extendFromBlock: { flex: 1, alignItems: 'flex-end' },
  extendFromLabel: { color: '#888', fontSize: 11 },
  extendFromTime: { color: '#FFF', fontSize: 24, fontWeight: '700', marginTop: 2 },
  lyricsSection: { marginHorizontal: 16 },
  lyricsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  lyricsSectionTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  instrumentalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  instrumentalLabel: { color: '#AAA', fontSize: 14 },
  lyricsBox: { backgroundColor: '#111', borderRadius: 12, padding: 16 },
  lyricLine: { color: '#CCC', fontSize: 15, lineHeight: 26 },
  lyricSection: { color: '#777', marginTop: 10, marginBottom: 2 },
  lyricPlaceholder: { color: '#555', fontSize: 14, fontStyle: 'italic' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 40, backgroundColor: '#0A0A0A' },
  extendBtn: { borderRadius: 50, overflow: 'hidden' },
  extendBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 50 },
  extendBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});