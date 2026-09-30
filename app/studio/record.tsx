import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from '@/mock-expo-av';
import { useThemeStore } from '../../store/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassBackButton from '../../components/GlassBackButton';
import { usePlayerStore } from '../../store/playerStore';

export default function RecordScreen() {
  const router = useRouter();
  const { beatId, beatUrl, beatTitle } = useLocalSearchParams<{ beatId: string; beatUrl: string; beatTitle: string }>();
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const insets = useSafeAreaInsets();
  const { pausePlayer } = usePlayerStore();

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [vocalUri, setVocalUri] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const beatSoundRef = useRef<Audio.Sound | null>(null);
  const vocalSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    pausePlayer(); // Pause global track player to avoid interference
    setupAudioMode();
    loadBeat();
    return () => {
      cleanup();
    };
  }, []);

  const setupAudioMode = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (e) {
      console.warn('Error setting up audio mode:', e);
    }
  };

  const loadBeat = async () => {
    if (!beatUrl) return;
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: beatUrl });
      beatSoundRef.current = sound;
    } catch (e) {
      Alert.alert('Error', 'Failed to load the beat.');
    }
  };

  const cleanup = async () => {
    if (beatSoundRef.current) await beatSoundRef.current.unloadAsync();
    if (vocalSoundRef.current) await vocalSoundRef.current.unloadAsync();
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch (e) {}
    }
    
    // Crucial for iOS: Return audio mode to playback so TrackPlayer isn't muffled!
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (e) {
      console.warn('Error resetting audio mode:', e);
    }
  };

  const startRecording = async () => {
    try {
      setVocalUri(null);
      if (beatSoundRef.current) await beatSoundRef.current.setPositionAsync(0);

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);

      // Start playing the beat at the same time
      if (beatSoundRef.current) await beatSoundRef.current.playAsync();
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    try {
      if (beatSoundRef.current) await beatSoundRef.current.stopAsync();
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setVocalUri(uri);
      setRecording(null);
    } catch (error) {
      console.error('Failed to stop recording', error);
    }
  };

  const togglePreview = async () => {
    if (isPlayingPreview) {
      // Stop preview
      if (beatSoundRef.current) await beatSoundRef.current.stopAsync();
      if (vocalSoundRef.current) await vocalSoundRef.current.stopAsync();
      setIsPlayingPreview(false);
    } else {
      // Start preview
      if (!vocalUri) return;
      try {
        if (!vocalSoundRef.current) {
          const { sound } = await Audio.Sound.createAsync({ uri: vocalUri });
          vocalSoundRef.current = sound;
        }
        
        if (beatSoundRef.current) await beatSoundRef.current.setPositionAsync(0);
        if (vocalSoundRef.current) await vocalSoundRef.current.setPositionAsync(0);

        if (beatSoundRef.current) await beatSoundRef.current.playAsync();
        if (vocalSoundRef.current) await vocalSoundRef.current.playAsync();
        
        setIsPlayingPreview(true);

        // Simple sync to stop playing when finished (using the vocal track duration)
        vocalSoundRef.current.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlayingPreview(false);
            beatSoundRef.current?.stopAsync();
          }
        });

      } catch (e) {
        console.error('Playback preview error', e);
      }
    }
  };

  const handleNext = () => {
    if (!vocalUri) return;
    // Stop any ongoing playback before navigating
    cleanup();
    router.push({ pathname: '/studio/publish', params: { beatId, vocalUri, beatTitle } });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <GlassBackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Studio</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <Ionicons name="musical-notes-outline" size={80} color={COLORS.gold} style={{ marginBottom: 20 }} />
        <Text style={styles.beatTitle}>Recording over: {beatTitle}</Text>
        
        {isRecording ? (
          <View style={styles.recordingIndicator}>
            <ActivityIndicator size="small" color={COLORS.error} />
            <Text style={styles.recordingText}>Recording...</Text>
          </View>
        ) : (
          <Text style={styles.instructionText}>Press the mic to start recording your vocals.</Text>
        )}

        <View style={styles.controlsRow}>
          {vocalUri && !isRecording && (
            <TouchableOpacity style={styles.iconBtn} onPress={togglePreview}>
              <Ionicons name={isPlayingPreview ? "stop" : "play"} size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.recordBtn, isRecording && styles.recordBtnActive]} 
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Ionicons name={isRecording ? "square" : "mic"} size={36} color="#fff" />
          </TouchableOpacity>

          {vocalUri && !isRecording && (
            <TouchableOpacity style={styles.iconBtn} onPress={handleNext}>
              <Ionicons name="checkmark" size={28} color={COLORS.success} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  beatTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 40 },
  recordingText: { color: COLORS.error, fontSize: 16, fontWeight: '700', marginLeft: 8 },
  instructionText: { color: COLORS.textSecondary, fontSize: 16, textAlign: 'center', marginBottom: 40 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  recordBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,59,48,0.3)' },
  recordBtnActive: { borderRadius: 20 }, // Square-ish shape when recording
  iconBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
});
