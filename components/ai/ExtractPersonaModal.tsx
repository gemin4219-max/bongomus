import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassView as BlurView } from '@/components/GlassView';
import { LinearGradient } from 'expo-linear-gradient';

import { generatePersona } from '../../lib/sunoApi';
import { useAIStore } from '../../store/aiStore';
import { useThemeStore } from '../../store/themeStore';


interface ExtractPersonaModalProps {
  audioId: string | null;
  taskId?: string | null;
  onClose: () => void;
}

export default function ExtractPersonaModal({ audioId, taskId, onClose }: ExtractPersonaModalProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const [personaName, setPersonaName] = useState('');
  const [personaDesc, setPersonaDesc] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const { addPersona } = useAIStore();

  const handleExtract = async () => {
    if (!personaName || !personaDesc || !audioId) {
      Alert.alert("Missing Fields", "Please provide a name and description.");
      return;
    }

    setIsExtracting(true);
    try {
      const personaId = await generatePersona(taskId || '', audioId, personaName, personaDesc);
      addPersona({
        id: personaId,
        name: personaName,
        description: personaDesc,
        createdAt: Date.now(),
        type: 'style',
      });
      setPersonaName('');
      setPersonaDesc('');
      Alert.alert("Success", "Persona extracted successfully! You can now use it to cover audio.");
      onClose();
    } catch (e: any) {
      Alert.alert("Extract Error", e.message);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <Modal visible={!!audioId} transparent animationType="fade">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <BlurView intensity={70} tint="dark" style={styles.overlay}>
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="person-add" size={24} color={COLORS.gold} />
                <Text style={styles.title}>Extract Persona</Text>
              </View>
              <TouchableOpacity onPress={onClose} disabled={isExtracting}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.desc}>
              Extract a Persona from this track to capture its unique voice and musical characteristics.
            </Text>
            
            <Text style={styles.label}>Persona Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Swahili Pop Star"
              placeholderTextColor={COLORS.textTertiary}
              value={personaName}
              onChangeText={setPersonaName}
              editable={!isExtracting}
            />

            <Text style={styles.label}>Persona Description</Text>
            <TextInput
              style={[styles.input, { height: 100 }]}
              placeholder="Describe the musical style, mood, and vocal qualities..."
              placeholderTextColor={COLORS.textTertiary}
              value={personaDesc}
              onChangeText={setPersonaDesc}
              multiline
              textAlignVertical="top"
              editable={!isExtracting}
            />
            
            <TouchableOpacity 
              style={[styles.generateBtn, isExtracting && { opacity: 0.5 }]} 
              onPress={handleExtract} 
              disabled={isExtracting}
            >
              <LinearGradient colors={[COLORS.gold, '#F9A826']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
              {isExtracting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={COLORS.black} />
                  <Text style={styles.generateBtnText}>Extracting...</Text>
                </View>
              ) : (
                <Text style={styles.generateBtnText}>Save Persona</Text>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  content: { width: '100%', backgroundColor: 'rgba(28,28,30,0.85)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  desc: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 20, lineHeight: 20 },
  label: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: 'rgba(0,0,0,0.3)', color: COLORS.textPrimary, padding: 16, borderRadius: 16, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  generateBtn: { paddingVertical: 16, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: 24, overflow: 'hidden' },
  generateBtnText: { color: COLORS.black, fontSize: 16, fontWeight: '800' },
});
