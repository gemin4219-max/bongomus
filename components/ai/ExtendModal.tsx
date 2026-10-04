// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { extendAudio } from '../../lib/sunoApi';

interface ExtendModalProps {
  visible: boolean;
  onClose: () => void;
  audioId: string | null;
  onSuccess: (taskId: string, originalTitle: string) => void;
  originalTitle: string;
}

export default function ExtendModal({ visible, onClose, audioId, onSuccess, originalTitle }: ExtendModalProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const [lyrics, setLyrics] = useState('');
  const [continueAt, setContinueAt] = useState('');
  const [isExtending, setIsExtending] = useState(false);

  const handleExtend = async () => {
    if (!audioId) return;
    if (!lyrics.trim()) {
      Alert.alert("Missing Lyrics", "Please provide the lyrics for the extension.");
      return;
    }

    setIsExtending(true);
    try {
      const { profile, fetchProfile } = useAuthStore.getState();
      if (!profile || profile.credits < 2) {
        throw new Error("You need at least 2 credits to extend a song.");
      }

      // Deduct 2 credits
      const { error: creditError } = await supabase
        .from('profiles')
        .update({ credits: profile.credits - 2 })
        .eq('id', profile.id);
      if (creditError) throw creditError;
      
      await fetchProfile();

      // Extend Audio
      const taskId = await extendAudio(audioId, lyrics, continueAt.trim());
      
      onSuccess(taskId, originalTitle);
      
      setLyrics('');
      setContinueAt('');
      onClose();
    } catch (e: any) {
      Alert.alert("Extend Error", e.message);
    } finally {
      setIsExtending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBg}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Extend Song</Text>
            <TouchableOpacity onPress={onClose} disabled={isExtending}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.modalSub}>Extending: {originalTitle || 'AI Track'}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Lyrics</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter the lyrics you want to sing next..."
              placeholderTextColor={COLORS.textTertiary}
              value={lyrics}
              onChangeText={setLyrics}
              multiline
              editable={!isExtending}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Extend From Time (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 01:23 (Defaults to end)"
              placeholderTextColor={COLORS.textTertiary}
              value={continueAt}
              onChangeText={setContinueAt}
              editable={!isExtending}
            />
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleExtend} disabled={isExtending}>
            {isExtending ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="flash" size={18} color="#000" />
                <Text style={styles.submitBtnText}>Extend Song (2 Credits)</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  modalSub: { fontSize: 13, color: COLORS.gold, marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  input: { backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, color: COLORS.textPrimary, fontSize: 15 },
  textArea: { height: 120, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: COLORS.gold, borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 },
  submitBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
});
