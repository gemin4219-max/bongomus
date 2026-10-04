// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, useAudioPlayer, requestRecordingPermissionsAsync, RecordingPresets } from 'expo-audio';
import { useThemeStore } from '../../store/themeStore';

interface AudioRecorderProps {
  onAudioReady: (uri: string, name: string) => void;
  onClear: () => void;
  currentAudioUri?: string | null;
  currentAudioName?: string | null;
}

export default function AudioRecorder({ onAudioReady, onClear, currentAudioUri, currentAudioName }: AudioRecorderProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [timer, setTimer] = useState<any | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(currentAudioUri ? currentAudioUri : null);

  useEffect(() => {
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [timer]);

  const startRecording = async () => {
    try {
      if (player && isPlaying) {
        player.pause();
        setIsPlaying(false);
      }
      
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return;

      recorder.record();
      setIsRecording(true);
      setDuration(0);
      
      const newTimer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      setTimer(newTimer);
      
    } catch (err: any) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording. Please check your microphone permissions.');
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (timer) clearInterval(timer);

    await recorder.stop();
    
    const uri = recorder.uri;
    if (uri) {
      onAudioReady(uri, `Voice_Memo_${new Date().getTime()}.m4a`);
    }
  };

  const playSound = async () => {
    if (!currentAudioUri || !player) return;
    
    try {
      player.play();
      setIsPlaying(true);
    } catch (e: any) {
      console.error(e);
      alert("Could not play this audio.");
    }
  };

  const pauseSound = async () => {
    if (player) {
      player.pause();
      setIsPlaying(false);
    }
  };

  const clearAudio = async () => {
    if (player) {
      player.pause();
    }
    setIsPlaying(false);
    setDuration(0);
    onClear();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (currentAudioUri) {
    return (
      <View style={styles.audioPill}>
        <TouchableOpacity onPress={isPlaying ? pauseSound : playSound} style={styles.playBtn}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={20} color={COLORS.black} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
            {currentAudioName || 'Recorded Audio'}
          </Text>
          <Text style={{ color: COLORS.textTertiary, fontSize: 11 }}>Tap play to listen</Text>
        </View>
        <TouchableOpacity onPress={clearAudio} style={{ padding: 4 }}>
          <Ionicons name="trash-outline" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.recordBtn, isRecording && styles.recordBtnActive]} 
        onPress={isRecording ? stopRecording : startRecording}
      >
        <View style={[styles.recordIcon, isRecording && styles.recordIconActive]} />
        <Text style={[styles.recordText, isRecording && { color: COLORS.error }]}>
          {isRecording ? `Stop Recording (${formatTime(duration)})` : 'Tap to Record Voice'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { width: '100%' },
  recordBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', padding: 16, borderRadius: 16, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  recordBtnActive: { backgroundColor: 'rgba(255, 59, 48, 0.1)', borderColor: 'rgba(255, 59, 48, 0.3)' },
  recordIcon: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.error },
  recordIconActive: { borderRadius: 4, transform: [{ scale: 1.2 }] },
  recordText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '700' },
  audioPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
});
