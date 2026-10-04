// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput, FlatList, KeyboardAvoidingView, Platform, Animated, Easing, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAudioRecorder, useAudioPlayer, useAudioPlayerStatus, requestRecordingPermissionsAsync, RecordingPresets } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { usePlayerStore, PlayerMode } from '../../store/playerStore';
import { supabase } from '../../lib/supabase';
import { Track } from '../../constants';
import GlassBackButton from '../../components/GlassBackButton';

export default function StationRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { COLORS } = useThemeStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const profile = useAuthStore(s => s.profile);
  const { setMode, playTrack, currentTrack, seekTo, setVolume } = usePlayerStore();

  const [station, setStation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [listeners, setListeners] = useState(0);
  const [mode, setLocalMode] = useState<PlayerMode>('listener');

  // Search Modal
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);

  // Voice Recording
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const voicePlayer = useAudioPlayer(null);
  const voiceStatus = useAudioPlayerStatus(voicePlayer);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [isSpeakerActive, setIsSpeakerActive] = useState(false);

  // Temp Local Tracks (Self-Destructing)
  const [sessionTempTracks, setSessionTempTracks] = useState<{ id: string; filename: string }[]>([]);
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);

  // DJ Queue (up to 3 songs)
  const [djQueue, setDjQueue] = useState<Track[]>([]);

  // Refs for tracking changes
  const currentTrackRef = useRef<string | null>(null);
  const currentVoiceRef = useRef<string | null>(null);

  // Animations
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (voiceStatus.didJustFinish && isSpeakerActive) {
      setVolume(1.0);
      setIsSpeakerActive(false);
    }
  }, [voiceStatus.didJustFinish]);

  useEffect(() => {
    let channel: any;
    let presenceChannel: any;

    const setupRoom = async () => {
      const { data, error } = await supabase.from('live_stations').select('*, profiles(display_name, username)').eq('id', id).single();
      if (error || !data) { setLoading(false); return; }

      setStation(data);
      const isHost = profile?.id === data.host_id;
      setLocalMode(isHost ? 'host' : 'listener');
      setMode(isHost ? 'host' : 'listener', id);

      currentTrackRef.current = data.current_track_id;
      currentVoiceRef.current = data.current_voice_url;

      if (!isHost && data.current_track_id) {
        syncToTrack(data.current_track_id, data.started_at);
      }

      channel = supabase.channel(`station_${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_stations', filter: `id=eq.${id}` }, (payload) => {
          setStation(payload.new);
          if (!isHost && payload.new.current_track_id && payload.new.current_track_id !== currentTrackRef.current) {
            currentTrackRef.current = payload.new.current_track_id;
            syncToTrack(payload.new.current_track_id, payload.new.started_at);
          }
          if (!isHost && payload.new.current_voice_url && payload.new.current_voice_url !== currentVoiceRef.current) {
            currentVoiceRef.current = payload.new.current_voice_url;
            playVoiceNote(payload.new.current_voice_url);
          }
        }).subscribe();

      presenceChannel = supabase.channel(`presence_${id}`, { config: { presence: { key: profile?.id || 'anon' } } });
      presenceChannel.on('presence', { event: 'sync' }, () => {
        setListeners(Object.keys(presenceChannel.presenceState()).length);
      }).subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') await presenceChannel.track({ user: profile?.id });
      });

      setLoading(false);
    };

    setupRoom();

    return () => {
      setMode('local', undefined);
      setVolume(1.0);
      if (channel) supabase.removeChannel(channel);
      if (presenceChannel) supabase.removeChannel(presenceChannel);
    };
  }, [id]);

  useEffect(() => {
    if (currentTrack || isSpeakerActive) {
      Animated.loop(Animated.timing(spinValue, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })).start();
      Animated.loop(Animated.sequence([
        Animated.timing(pulseValue, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseValue, { toValue: 1, duration: 800, useNativeDriver: true })
      ])).start();
    } else {
      spinValue.stopAnimation();
      pulseValue.stopAnimation();
    }
  }, [currentTrack, isSpeakerActive]);

  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const syncToTrack = async (trackId: string, startedAt: string) => {
    const { data: trackData } = await supabase.from('tracks').select('*, profiles(display_name)').eq('id', trackId).single();
    if (!trackData) return;
    const elapsedMs = Math.max(0, Date.now() - new Date(startedAt).getTime());
    await playTrack({ ...trackData, id: `${trackData.id}_sync` } as any);
    setTimeout(() => { seekTo(elapsedMs); }, 500);
  };

  const playVoiceNote = async (url: string) => {
    try {
      setIsSpeakerActive(true);
      await setVolume(0.15);
      voicePlayer.replace(url);
      voicePlayer.play();
    } catch (e) {
      setVolume(1.0);
      setIsSpeakerActive(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    const { data, error } = await supabase
      .from('tracks')
      .select('*, profile:profiles!tracks_user_id_fkey(*)')
      .eq('is_public', true)
      .or(`title.ilike.%${query}%,artist_name.ilike.%${query}%`)
      .limit(20);
    if (error) console.log('Station search error:', error.message);
    setSearchResults((data as any) || []);
  };

  const handleHostPlayTrack = async (track: Track) => {
    setIsSearchVisible(false);
    await playTrack(track);
  };

  const handleAddToQueue = (track: Track) => {
    if (djQueue.length >= 3) {
      Alert.alert('Queue Full', 'You can only queue up to 3 songs. Remove one first.');
      return;
    }
    if (djQueue.find(t => t.id === track.id)) {
      Alert.alert('Already Queued', 'This song is already in the queue.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setDjQueue(prev => [...prev, track]);
  };

  const handleRemoveFromQueue = (trackId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDjQueue(prev => prev.filter(t => t.id !== trackId));
  };

  const handlePlayNextFromQueue = async () => {
    if (djQueue.length === 0) return;
    const [next, ...rest] = djQueue;
    setDjQueue(rest);
    await playTrack(next);
  };

  const handleSelectLocalFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      
      const file = result.assets[0];
      setIsUploadingLocal(true);

      const filename = `local_live_${id}_${Date.now()}.m4a`;
      
      // Read file as base64 using expo-file-system for reliable upload
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' as any });
      const fileData = decode(base64);

      // Upload to audio bucket (hidden, will self-destruct on broadcast end)
      const { error: uploadError } = await supabase.storage.from('audio').upload(filename, fileData, {
        contentType: file.mimeType || 'audio/mpeg'
      });
      if (uploadError) {
        console.log('Local upload error:', uploadError.message);
        Alert.alert('Upload Failed', uploadError.message);
        setIsUploadingLocal(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('audio').getPublicUrl(filename);
      const audioUrl = publicUrlData.publicUrl;

      // Insert hidden track with all required fields
      const trackTitle = file.name.replace(/\.[^/.]+$/, "");
      const { data: newTrack, error: insertError } = await supabase.from('tracks').insert({
        user_id: profile?.id,
        title: trackTitle,
        artist_name: profile?.display_name || 'Host',
        audio_url: audioUrl,
        cover_url: profile?.avatar_url || '',
        genre: 'Live Session',
        duration_sec: 0,
        play_count: 0,
        like_count: 0,
        is_public: false, // HIDDEN from catalog
        is_ai: false
      }).select().single();

      if (insertError || !newTrack) {
        console.log('Insert error:', insertError?.message);
        Alert.alert('Track Insert Failed', insertError?.message || 'Unknown error');
        setIsUploadingLocal(false);
        return;
      }

      // Track it for self-destruction
      setSessionTempTracks(prev => [...prev, { id: newTrack.id, filename }]);
      setIsUploadingLocal(false);
      
      // Play it
      handleHostPlayTrack(newTrack as any);

    } catch (err: any) {
      console.log('Local file err:', err?.message || err);
      Alert.alert('Error', err?.message || 'Could not load file');
      setIsUploadingLocal(false);
    }
  };

  const startRecording = async () => {
    if (isRecording || isUploadingVoice) return;
    try {
      if (recorder.isRecording) { await recorder.stop(); }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await requestRecordingPermissionsAsync();
      recorder.record();
      setIsRecording(true);
      await setVolume(0.15);
    } catch (err) { console.error('recording err', err); }
  };

  const stopRecording = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setIsRecording(false);
      setVolume(1.0);
      if (!recorder.isRecording && !recorder.uri) return;
      if (recorder.isRecording) {
        await recorder.stop();
      }
      const uri = recorder.uri;
      if (!uri) return;

      setIsUploadingVoice(true);
      const filename = `voice_${id}_${Date.now()}.m4a`;
      const fileData = await fetch(uri).then(r => r.blob());
      const { error } = await supabase.storage.from('broadcast_audio').upload(filename, fileData);
      if (error) { setIsUploadingVoice(false); return; }
      
      const { data: publicUrlData } = supabase.storage.from('broadcast_audio').getPublicUrl(filename);
      await supabase.from('live_stations').update({ current_voice_url: publicUrlData.publicUrl, voice_started_at: new Date().toISOString() }).eq('id', id);
      setIsUploadingVoice(false);
    } catch (err) {
      setIsUploadingVoice(false);
      setVolume(1.0);
    }
  };

  const handleEndBroadcast = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    if (mode === 'host') {
      await supabase.from('live_stations').update({ status: 'offline' }).eq('id', id);
      
      // Self-Destruct local tracks!
      if (sessionTempTracks.length > 0) {
        const trackIds = sessionTempTracks.map(t => t.id);
        const filenames = sessionTempTracks.map(t => t.filename);
        await supabase.from('tracks').delete().in('id', trackIds);
        await supabase.storage.from('audio').remove(filenames);
      }
    }
    router.back();
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator color="#FF3B30" size="large" /></View>;

  if (!station || station.status === 'offline') {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="radio" size={60} color="#555" />
        <Text style={styles.offlineText}>Broadcast Offline</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}><Text style={styles.goBackText}>Leave Studio</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) }]}>
      
      {/* Top Bar - Neon "ON AIR" */}
      <View style={styles.header}>
        <GlassBackButton onPress={() => router.back()} />
        <View style={styles.onAirContainer}>
          <Animated.View style={[styles.onAirGlow, { transform: [{ scale: pulseValue }], opacity: currentTrack || isSpeakerActive ? 1 : 0.4 }]} />
          <Text style={styles.onAirText}>ON AIR</Text>
        </View>
        <View style={styles.listenersBadge}>
          <Ionicons name="people" size={14} color="#FFF" />
          <Text style={styles.listenersText}>{listeners}</Text>
        </View>
      </View>

      {/* Middle - Turntable */}
      <View style={styles.turntableSection}>
        <View style={styles.turntableBase}>
          <Animated.View style={[styles.vinylRecord, { transform: [{ rotate: spin }] }]}>
            <View style={styles.vinylGrooves} />
            <View style={styles.vinylGrooves2} />
            <View style={styles.vinylCenter}>
              <Image source={{ uri: currentTrack?.cover_url || station.cover_url }} style={styles.albumArt} contentFit="cover" />
            </View>
          </Animated.View>
        </View>
        <View style={styles.trackInfoPanel}>
          <Text style={styles.npLabel}>NOW PLAYING</Text>
          <Text style={styles.npTitle} numberOfLines={1}>{currentTrack?.title || 'Silence'}</Text>
          <Text style={styles.npArtist} numberOfLines={1}>{currentTrack?.artist_name || station.profiles?.display_name}</Text>
        </View>
      </View>

      {/* DJ Queue Panel - visible between turntable and soundboard */}
      {mode === 'host' && djQueue.length > 0 && (
        <View style={styles.queuePanel}>
          <Text style={styles.queueLabel}>UP NEXT</Text>
          {djQueue.map((track, index) => (
            <View key={track.id} style={styles.queueItem}>
              <Text style={styles.queueNum}>{index + 1}</Text>
              <Image source={{ uri: track.cover_url || undefined }} style={styles.queueThumb} contentFit="cover" />
              <View style={styles.queueInfo}>
                <Text style={styles.queueTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.queueArtist} numberOfLines={1}>{track.artist_name}</Text>
              </View>
              {index === 0 && (
                <TouchableOpacity onPress={handlePlayNextFromQueue} style={styles.queuePlayBtn}>
                  <Ionicons name="play-skip-forward" size={18} color="#FFD700" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleRemoveFromQueue(track.id)} style={styles.queueRemoveBtn}>
                <Ionicons name="close" size={18} color="#888" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Bottom - Soundboard (Host) / Overlay (Listener) */}
      <View style={styles.soundboard}>
        <LinearGradient colors={['#2A2A35', '#16161D']} style={styles.soundboardGradient}>
          
          <View style={styles.soundboardTopStrip}>
             <View style={styles.screw} />
             <Text style={styles.soundboardBrand}>BONGO STREAM PRO-LIVE</Text>
             <View style={styles.screw} />
          </View>

          {mode === 'host' ? (
            <View style={styles.controlsGrid}>
              
              <View style={styles.deckControl}>
                <Text style={styles.controlLabel}>DECK A</Text>
                <TouchableOpacity style={styles.loadBtn} onPress={() => setIsSearchVisible(true)}>
                  <Ionicons name="disc" size={24} color="#FFD700" />
                  <Text style={styles.loadBtnText}>Load Track</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.micControl}>
                <Text style={styles.controlLabel}>TALKBACK</Text>
                <TouchableOpacity 
                  style={[styles.micBtn, isRecording && styles.micBtnActive]} 
                  onPressIn={startRecording} onPressOut={stopRecording} activeOpacity={0.8}
                >
                  <Ionicons name="mic" size={40} color={isRecording ? '#FFF' : '#FF3B30'} />
                </TouchableOpacity>
                <Text style={styles.micSubtext}>{isRecording ? 'RECORDING...' : 'PUSH TO TALK'}</Text>
              </View>

              <View style={styles.deckControl}>
                <Text style={styles.controlLabel}>MASTER</Text>
                <TouchableOpacity style={styles.killBtn} onPress={handleEndBroadcast}>
                  <Ionicons name="power" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.micSubtext}>END LIVE</Text>
              </View>

            </View>
          ) : (
             <View style={styles.listenerOverlay}>
               {isSpeakerActive ? (
                  <View style={styles.hostSpeakingBox}>
                    <Animated.View style={[styles.speakingIndicator, { transform: [{ scale: pulseValue }] }]} />
                    <Text style={styles.hostSpeakingText}>{station.profiles?.display_name} is speaking...</Text>
                  </View>
               ) : (
                  <>
                    <Ionicons name="headset" size={40} color="#666" />
                    <Text style={styles.listenerText}>Tuned in to {station.profiles?.display_name}'s Broadcast</Text>
                    <Text style={styles.listenerSubtext}>Sit back and enjoy the music.</Text>
                  </>
               )}
             </View>
          )}

        </LinearGradient>
      </View>

      {/* Search Modal */}
      <Modal visible={isSearchVisible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'formSheet' : 'fullScreen'} onRequestClose={() => setIsSearchVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.modalContainer, { backgroundColor: '#111' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Load Track to Deck</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {djQueue.length > 0 && (
                <View style={styles.queueCountBadge}>
                  <Text style={styles.queueCountText}>{djQueue.length}/3 queued</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => setIsSearchVisible(false)}><Ionicons name="close" size={28} color="#FFF" /></TouchableOpacity>
            </View>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search Bongo Stream..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
          />
          
          <TouchableOpacity 
            style={styles.localUploadBtn} 
            onPress={handleSelectLocalFile}
            disabled={isUploadingLocal}
          >
            {isUploadingLocal ? (
              <ActivityIndicator color="#FFD700" size="small" />
            ) : (
              <>
                <Ionicons name="folder-open" size={24} color="#FFD700" />
                <Text style={styles.localUploadBtnText}>Play Local Audio File (Live Only)</Text>
              </>
            )}
          </TouchableOpacity>

          <FlatList
            data={searchResults}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.searchResultItem}>
                <Image source={{ uri: item.cover_url || undefined }} style={styles.searchResultImage} />
                <View style={styles.searchResultInfo}>
                  <Text style={styles.searchResultTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.searchResultArtist} numberOfLines={1}>{item.artist_name}</Text>
                </View>
                <TouchableOpacity 
                  style={[
                    styles.queueAddBtn,
                    djQueue.find(t => t.id === item.id) && styles.queueAddBtnActive
                  ]}
                  onPress={() => handleAddToQueue(item)}
                  disabled={djQueue.length >= 3 || !!djQueue.find(t => t.id === item.id)}
                >
                  <Text style={styles.queueAddBtnText}>
                    {djQueue.find(t => t.id === item.id) ? '✓ Queued' : '+ Queue'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.playNowBtn} onPress={() => handleHostPlayTrack(item)}>
                  <Text style={styles.playNowBtnText}>▶ Play</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
  loadingContainer: { flex: 1, backgroundColor: '#0A0A0C', justifyContent: 'center', alignItems: 'center' },
  offlineText: { color: '#FFF', fontSize: 20, marginTop: 16, fontWeight: '700' },
  goBackBtn: { marginTop: 24, backgroundColor: '#222', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25 },
  goBackText: { color: '#FFF', fontWeight: '600' },
  
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, justifyContent: 'space-between', zIndex: 10 },
  iconBtn: { padding: 8 },
  onAirContainer: { position: 'relative', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  onAirGlow: { position: 'absolute', width: '100%', height: '100%', backgroundColor: '#FF3B30', borderRadius: 8, opacity: 0.8, shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 15, elevation: 10 },
  onAirText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  
  listenersBadge: { backgroundColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  listenersText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  
  turntableSection: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  turntableBase: { width: 280, height: 280, backgroundColor: '#1A1A1A', borderRadius: 140, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.8, shadowRadius: 30, elevation: 20, borderWidth: 2, borderColor: '#333' },
  vinylRecord: { width: 260, height: 260, backgroundColor: '#050505', borderRadius: 130, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#111' },
  vinylGrooves: { position: 'absolute', width: 230, height: 230, borderRadius: 115, borderWidth: 1, borderColor: '#1A1A1A' },
  vinylGrooves2: { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 1, borderColor: '#151515' },
  vinylCenter: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 4, borderColor: '#000' },
  albumArt: { width: '100%', height: '100%' },
  
  trackInfoPanel: { marginTop: 40, alignItems: 'center', width: '80%' },
  npLabel: { color: '#FFD700', fontSize: 12, fontWeight: '800', letterSpacing: 3, marginBottom: 8 },
  npTitle: { color: '#FFF', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  npArtist: { color: '#AAA', fontSize: 16, textAlign: 'center' },
  
  soundboard: { minHeight: 200, width: '100%', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  soundboardGradient: { flex: 1, padding: 20 },
  soundboardTopStrip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 10, marginBottom: 20 },
  screw: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#555' },
  soundboardBrand: { color: '#555', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  
  controlsGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flex: 1, paddingBottom: 10 },
  deckControl: { alignItems: 'center', flex: 1 },
  controlLabel: { color: '#888', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 16 },
  
  loadBtn: { backgroundColor: '#1A1A24', paddingVertical: 16, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 4, width: '90%' },
  loadBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700', marginTop: 8 },
  
  micControl: { alignItems: 'center', flex: 1.2 },
  micBtn: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#1A1A24', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#FF3B30', shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 10 },
  micBtnActive: { backgroundColor: '#FF3B30', borderColor: '#FFF', transform: [{ scale: 0.95 }], shadowOpacity: 0.8 },
  micSubtext: { color: '#888', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 12 },
  
  killBtn: { backgroundColor: '#1A1A24', width: 60, height: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FF3B30' },
  
  listenerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 },
  listenerText: { color: '#FFF', fontSize: 16, fontWeight: '700', marginTop: 16 },
  listenerSubtext: { color: '#888', fontSize: 14, marginTop: 8 },
  
  hostSpeakingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 59, 48, 0.2)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, borderWidth: 1, borderColor: '#FF3B30' },
  speakingIndicator: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF3B30', marginRight: 12 },
  hostSpeakingText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  modalContainer: { flex: 1, paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  searchInput: { marginHorizontal: 20, height: 50, borderRadius: 12, paddingHorizontal: 16, fontSize: 16, marginBottom: 16, backgroundColor: '#222', color: '#FFF' },
  localUploadBtn: { marginHorizontal: 20, marginBottom: 16, backgroundColor: '#1A1A24', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFD700', gap: 10 },
  localUploadBtnText: { color: '#FFD700', fontSize: 16, fontWeight: '700' },
  queueCountBadge: { backgroundColor: '#FFD700', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  queueCountText: { color: '#000', fontSize: 11, fontWeight: '800' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222', gap: 8 },
  searchResultImage: { width: 46, height: 46, borderRadius: 8 },
  searchResultInfo: { flex: 1 },
  searchResultTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2, color: '#FFF' },
  searchResultArtist: { fontSize: 12, color: '#888' },
  queueAddBtn: { backgroundColor: '#1A1A24', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#555' },
  queueAddBtnActive: { borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.15)' },
  queueAddBtnText: { color: '#AAA', fontSize: 12, fontWeight: '700' },
  playNowBtn: { backgroundColor: '#FFD700', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  playNowBtnText: { color: '#000', fontSize: 12, fontWeight: '800' },

  // Queue panel styles
  queuePanel: { backgroundColor: 'rgba(30,30,40,0.95)', borderRadius: 12, marginHorizontal: 16, marginBottom: 8, padding: 12, borderWidth: 1, borderColor: '#333' },
  queueLabel: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  queueItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  queueNum: { color: '#555', fontSize: 12, fontWeight: '800', width: 14, textAlign: 'center' },
  queueThumb: { width: 32, height: 32, borderRadius: 6 },
  queueInfo: { flex: 1 },
  queueTitle: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  queueArtist: { color: '#888', fontSize: 11 },
  queuePlayBtn: { padding: 4 },
  queueRemoveBtn: { padding: 4 },
});
