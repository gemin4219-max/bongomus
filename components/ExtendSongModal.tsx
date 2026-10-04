// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Switch, Animated, PanResponder, Dimensions, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useAIStore } from '../store/aiStore';
import { useAuthStore } from '../store/authStore';
import { extendAudio, getTaskInfo } from '../lib/sunoApi';
import { usePlayerStore, usePlaybackState, useProgress, State } from '../store/playerStore';
import * as Haptics from 'expo-haptics';

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
  const trackId = track?.id || songTask?.taskId || songTask?.id;
  const audioUrl = track?.audioUrl || track?.audio_url || '';

  const { profile, session } = useAuthStore() as any;
  const { addTask, updateTask } = useAIStore();
  const { playTrack, togglePlayPause, seekTo, currentTrack } = usePlayerStore();
  const { state: pbState } = usePlaybackState();
  const progress = useProgress();

  const isThisTrack = !!trackId && currentTrack?.id === trackId;
  const isPlaying = isThisTrack && (pbState === State.Playing || pbState === State.Buffering);

  // Prefer saved duration; fall back to the real duration reported by the player
  const savedDuration = track?.duration || track?.duration_sec || 0;
  const duration = savedDuration > 0 ? savedDuration : (isThisTrack ? progress.duration : 0);
  const position = isThisTrack ? progress.position : 0;
  const playRatio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

  const maxMarkerX = Math.max(0, WAVEFORM_WIDTH - MARKER_WIDTH);
  const [markerXAnimated] = useState(new Animated.Value(maxMarkerX));
  const [markerX, setMarkerX] = useState(maxMarkerX);
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [isExtending, setIsExtending] = useState(false);

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
      onPanResponderMove: (e, gestureState) => {
        let newX = maxMarkerX + gestureState.dx;
        if (newX < 0) newX = 0;
        if (newX > maxMarkerX) newX = maxMarkerX;
        markerXAnimated.setValue(newX);
      },
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isThisTrack) {
      // Same song already loaded → just pause / resume
      await togglePlayPause();
      return;
    }
    if (!audioUrl) {
      Alert.alert('Not ready', 'This song has no audio yet.');
      return;
    }
    await playTrack({
      id: trackId || "unknown-track",
      title: track?.title || 'Untitled',
      audio_url: audioUrl,
      cover_url: track?.imageUrl || track?.cover_url,
      duration_sec: savedDuration,
      lyrics: track?.lyrics || track?.prompt,
      is_ai: true,
      user_id: session?.user?.id,
      artist_name: profile?.username || 'BongoBox Creator',
    } as any);
  };

  // Tap anywhere on the waveform to jump there
  const handleWaveformSeek = async (x: number) => {
    if (!isThisTrack || duration <= 0) return;
    const usable = WAVEFORM_WIDTH - 8;
    const ratio = Math.min(1, Math.max(0, (x - 4) / usable));
    await seekTo(ratio * duration * 1000);
  };

  // Lyrics: strip [mm:ss.xx] sync stamps, keep the times to highlight the current line
  const parsedLyrics = useMemo(() => {
    const raw: string = track?.lyrics || track?.prompt || '';
    return raw.split('\n').map((line) => {
      const m = line.match(/^\s*\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]\s*(.*)$/);
      if (m) return { time: parseInt(m[1], 10) * 60 + parseFloat(m[2]), text: m[3] };
      return { time: -1, text: line };
    });
  }, [track?.lyrics, track?.prompt]);
  const hasSyncedLyrics = parsedLyrics.some((l) => l.time >= 0);
  const activeLyricIdx = useMemo(() => {
    if (!hasSyncedLyrics || !isThisTrack) return -1;
    let idx = -1;
    parsedLyrics.forEach((l, i) => { if (l.time >= 0 && position >= l.time) idx = i; });
    return idx;
  }, [parsedLyrics, hasSyncedLyrics, isThisTrack, position]);
  const cleanLyricsText = parsedLyrics.map((l) => l.text).join('\n').trim();

  const handleExtend = async () => {
    if (!track?.id) {
      Alert.alert('Error', 'Invalid track selected.');
      return;
    }
    setIsExtending(true);
    try {
      // API rule: 0 < continueAt < source duration. The marker defaults to the
      // very end, so pull it 1s inside the song.
      const continueAt =
        duration > 2 ? Math.min(Math.max(1, Math.floor(extendFromSec)), Math.floor(duration - 1)) : undefined;

      // Only the words that come AFTER the cut point. Sending the whole song's
      // lyrics makes the extension re-sing the song from the top. If we don't
      // know the timing, leave it empty and Suno writes a natural continuation.
      let extendLyrics = '';
      if (!isInstrumental && hasSyncedLyrics && continueAt !== undefined) {
        extendLyrics = parsedLyrics
          .filter((l) => l.time >= continueAt)
          .map((l) => l.text)
          .join('\n')
          .trim();
      }

      const baseTitle = (track.title || 'Untitled').replace(/\s*\(Extended\)\s*$/i, '');
      const taskId = await extendAudio(track.id, extendLyrics, continueAt, {
        instrumental: isInstrumental,
        taskId: songTask?.sunoTaskId || track?.taskId,
        style: track.tags || track.genre,
        title: `${baseTitle} (Extended)`,
        sourceDuration: duration,
      });

      addTask(taskId, `${baseTitle} (Extended)`, 'GENERATE');
      updateTask(taskId, 'PROCESSING');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();

      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const taskInfo = await getTaskInfo(taskId);
          const status = taskInfo?.status?.toUpperCase?.() ?? '';

          if (status === 'SUCCESS') {
            clearInterval(pollInterval);
            const results = (taskInfo.data || [])
              .filter((t: any) => t?.audioUrl)
              .map((t: any) => ({ ...t, taskId }));
            updateTask(taskId, 'SUCCESS', results);

            if (results.length && profile?.id) {
              for (let i = 0; i < results.length; i++) {
                const t: any = results[i];
                await supabase.from('tracks').insert({
                  user_id: profile.id,
                  title: `${baseTitle} (Extended)${results.length > 1 ? ` v${i + 1}` : ''}`,
                  artist_name: profile.username || 'BongoBox Creator',
                  genre: track.genre || track.tags || 'AI Generated',
                  audio_url: t.audioUrl,
                  cover_url: t.imageUrl || track.imageUrl || track.cover_url || null,
                  duration_sec: Math.floor(t.duration || 0),
                  lyrics: t.lyrics || extendLyrics || track.lyrics || null,
                  is_public: false,
                  is_ai: true,
                });
              }
            }
          } else if (status === 'FAILED' || status === 'SENSITIVE_WORD_ERROR') {
            clearInterval(pollInterval);
            updateTask(taskId, status === 'SENSITIVE_WORD_ERROR' ? 'SENSITIVE_WORD_ERROR' : 'FAILED');
          } else if (attempts >= 60) {
            // ~5 minutes — give up instead of polling forever
            clearInterval(pollInterval);
            updateTask(taskId, 'FAILED', undefined, 'Extension timed out');
          }
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
  const playedBars = Math.round(playRatio * waveform.length);
  const playheadLeft = 4 + playRatio * (WAVEFORM_WIDTH - 8);

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
            <View
              style={styles.waveformBars}
              onStartShouldSetResponder={() => isThisTrack}
              onResponderRelease={(e) => handleWaveformSeek(e.nativeEvent.locationX)}
            >
              {waveform.map((amp, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveBar,
                    { height: Math.max(3, amp * 62) },
                    i < playedBars && styles.waveBarPlayed,
                  ]}
                />
              ))}
              {/* Live playhead synced with playback */}
              {isThisTrack && duration > 0 && (
                <View pointerEvents="none" style={[styles.playhead, { left: playheadLeft }]}>
                  <View style={styles.playheadDot} />
                </View>
              )}
              <Animated.View
                style={[styles.marker, { left: markerX }]}
                {...panResponder.panHandlers}
              >
                <View style={styles.markerLine} />
              </Animated.View>
            </View>
          </View>

          <View style={styles.playRow}>
            <TouchableOpacity style={[styles.playBtn, isPlaying && styles.playBtnActive]} onPress={handlePlayToggle}>
              {isThisTrack && pbState === State.Loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#FFF" style={!isPlaying && { marginLeft: 2 }} />
              )}
            </TouchableOpacity>
            <Text style={styles.positionText}>
              {formatTime(position)} / {durationStr}
            </Text>
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
              {cleanLyricsText && !isInstrumental ? (
                parsedLyrics.map((l, i) => {
                  const line = l.text;
                  const isSection = line.startsWith('[') && line.endsWith(']');
                  const isActive = i === activeLyricIdx;
                  return (
                    <Text
                      key={i}
                      style={[
                        styles.lyricLine,
                        isSection && styles.lyricSection,
                        hasSyncedLyrics && isThisTrack && !isActive && styles.lyricDim,
                        isActive && styles.lyricActive,
                      ]}
                    >
                      {line || ' '}
                    </Text>
                  );
                })
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
  waveBarPlayed: { backgroundColor: '#FF8C00' },
  playhead: { position: 'absolute', top: 4, bottom: 4, width: 2, marginLeft: -1, backgroundColor: '#FFF', borderRadius: 1, zIndex: 5, alignItems: 'center' },
  playheadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF', marginTop: -2 },
  marker: { position: 'absolute', top: 0, bottom: 0, width: MARKER_WIDTH, backgroundColor: 'rgba(180,40,80,0.88)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  markerLine: { width: 3, height: 36, backgroundColor: '#FFF', borderRadius: 2 },
  playRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 14, marginBottom: 24 },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  playBtnActive: { backgroundColor: '#FF2A75' },
  positionText: { color: '#AAA', fontSize: 13, marginLeft: 12, fontVariant: ['tabular-nums'] },
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
  lyricDim: { color: '#666' },
  lyricActive: { color: '#FF8C00', fontWeight: '700' },
  lyricPlaceholder: { color: '#555', fontSize: 14, fontStyle: 'italic' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 40, backgroundColor: '#0A0A0A' },
  extendBtn: { borderRadius: 50, overflow: 'hidden' },
  extendBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 50 },
  extendBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});