import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../../lib/supabase';
import { uploadAndCoverAudio } from '../../lib/sunoApi';
import { useAIStore } from '../../store/aiStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import AudioRecorder from './AudioRecorder';


interface UploadCoverTabProps {
  onGenerateSuccess: () => void;
  openLyricsModal?: (onComplete: (lyrics: string) => void) => void;
}

export default function UploadCoverTab({ onGenerateSuccess, openLyricsModal }: UploadCoverTabProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  
  const [coverPrompt, setCoverPrompt] = useState('');
  const [coverStyle, setCoverStyle] = useState('');
  const [coverTitle, setCoverTitle] = useState('');
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  const { personas, addTask } = useAIStore();
  const { session, profile } = useAuthStore();

  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAudioUri(result.assets[0].uri);
        setAudioName(result.assets[0].name);
      }
    } catch (e: any) {
      Alert.alert("Error picking audio", e.message);
    }
  };

  const handleUploadAndCover = async () => {
    if (!coverTitle || !coverStyle || !coverPrompt || !audioUri) {
      Alert.alert("Missing Fields", "Please fill out all text fields and select an audio file.");
      return;
    }
    
    const requiredCredits = 2;
    if ((profile?.credits || 0) < requiredCredits) {
      Alert.alert("Not Enough Credits", `You need ${requiredCredits} credits.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Buy Credits", onPress: () => router.push('/buy-credits') }
      ]);
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.rpc('deduct_credits', { user_id: profile?.id, amount: requiredCredits });
      if (error) {
        console.error("RPC Error:", error);
        throw new Error(`Failed to deduct credits: ${error.message}`);
      }
      if (data === false) {
        throw new Error("Failed to deduct credits: Insufficient balance in your Wallet.");
      }
      
      setIsUploadingAudio(true);
      const base64 = await FileSystem.readAsStringAsync(audioUri, { encoding: FileSystem.EncodingType.Base64 });
      const fileName = `${Date.now()}_${audioName || 'audio.mp3'}`;
      const { error: uploadErr } = await supabase.storage.from('audio').upload(`uploads/${fileName}`, decode(base64), { contentType: 'audio/mpeg' });
      if (uploadErr) throw uploadErr;
      
      const finalAudioUrl = supabase.storage.from('audio').getPublicUrl(`uploads/${fileName}`).data.publicUrl;
      setIsUploadingAudio(false);

      const isVoicePersona = personas.find(p => p.id === selectedPersona)?.description === "Custom Voice Clone";
      const taskId = await uploadAndCoverAudio({
        uploadUrl: finalAudioUrl,
        prompt: coverPrompt,
        style: coverStyle,
        title: coverTitle,
        ...(selectedPersona && {
          personaId: selectedPersona,
          personaModel: isVoicePersona ? 'voice_persona' : 'style_persona',
        }),
      });
      addTask(taskId, coverTitle);
      
      setCoverTitle('');
      setCoverStyle('');
      setCoverPrompt('');
      setAudioUri(null);
      setAudioName(null);
      
      if (session?.user.id) useAuthStore.getState().fetchProfile(session.user.id);
      
      onGenerateSuccess();
    } catch (e: any) {
      setIsUploadingAudio(false);
      Alert.alert("Error", e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const [showInfo, setShowInfo] = useState(true);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      {showInfo && (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={24} color={COLORS.gold} />
          <Text style={styles.infoText}>
            Upload an audio clip and completely redesign it using an AI Persona! The original melody will be covered in a brand new musical style.
          </Text>
          <TouchableOpacity onPress={() => setShowInfo(false)} style={{ padding: 4 }}>
            <Ionicons name="close" size={20} color={COLORS.gold} />
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.label}>Song Title</Text>
      <TextInput style={styles.input} placeholder="e.g. Acoustic Cover" placeholderTextColor={COLORS.textTertiary} value={coverTitle} onChangeText={setCoverTitle} />
      
      <Text style={styles.label}>Musical Style</Text>
      <TextInput style={styles.input} placeholder="e.g. Acoustic pop, upbeat" placeholderTextColor={COLORS.textTertiary} value={coverStyle} onChangeText={setCoverStyle} />
      
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
        <Text style={[styles.label, { marginTop: 0, marginBottom: 0 }]}>Lyrics (Your own words)</Text>
        {openLyricsModal && (
          <TouchableOpacity onPress={() => openLyricsModal((lyrics) => setCoverPrompt(lyrics))}>
            <Text style={{ color: COLORS.gold, fontSize: 13, fontWeight: '700' }}>Write with AI</Text>
          </TouchableOpacity>
        )}
      </View>
      <TextInput style={[styles.input, { height: 120 }]} placeholder="Write your own lyrics here..." placeholderTextColor={COLORS.textTertiary} value={coverPrompt} onChangeText={setCoverPrompt} multiline textAlignVertical="top" />

      <Text style={styles.label}>Source Audio File</Text>
      <View style={{ gap: 12 }}>
        {!audioUri && (
          <TouchableOpacity style={styles.uploadBtn} onPress={handlePickAudio}>
            <Ionicons name="cloud-upload-outline" size={20} color={COLORS.gold} />
            <Text style={styles.uploadBtnText}>Upload from Files</Text>
          </TouchableOpacity>
        )}
        
        <AudioRecorder 
          currentAudioUri={audioUri}
          currentAudioName={audioName}
          onAudioReady={(uri, name) => {
            setAudioUri(uri);
            setAudioName(name);
          }}
          onClear={() => {
            setAudioUri(null);
            setAudioName(null);
          }}
        />
      </View>

      <Text style={[styles.label, { marginTop: 32 }]}>Select Persona (Optional)</Text>
      {personas.length === 0 ? (
        <View style={styles.errorBox}>
          <Ionicons name="information-circle" size={20} color={COLORS.gold} />
          <Text style={{ color: COLORS.gold, fontSize: 13, flex: 1, fontWeight: '600' }}>No Personas found. You can cover this audio using general AI styles, or extract a persona from the Workspace later to use here!</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10, gap: 16 }}>
          {personas.map(p => (
            <TouchableOpacity 
              key={p.id} 
              style={[styles.personaCard, selectedPersona === p.id && styles.personaCardActive]}
              onPress={() => setSelectedPersona(p.id)}
            >
              <Text style={[styles.personaName, selectedPersona === p.id && { color: COLORS.gold }]}>{p.name}</Text>
              <Text style={styles.personaDesc} numberOfLines={3}>{p.description}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity style={[styles.generateBtn, isGenerating && { opacity: 0.5 }]} onPress={handleUploadAndCover} disabled={isGenerating}>
        <LinearGradient colors={[COLORS.gold, '#F9A826']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
        {isGenerating ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={COLORS.black} />
            <Text style={styles.generateBtnText}>{isUploadingAudio ? 'Uploading Audio...' : 'Covering Audio...'}</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="color-wand" size={20} color={COLORS.black} />
            <Text style={styles.generateBtnText}>Cover Audio (2 Credits)</Text>
          </View>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1 },
  infoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212, 175, 55, 0.1)', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  infoText: { color: COLORS.gold, fontSize: 13, lineHeight: 20, flex: 1, marginLeft: 12, fontWeight: '500' },
  label: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 24, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: { backgroundColor: 'rgba(255,255,255,0.03)', color: COLORS.textPrimary, padding: 16, borderRadius: 16, fontSize: 15, borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' },
  uploadBtn: { backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' },
  uploadBtnText: { color: COLORS.gold, fontWeight: '700', fontSize: 14 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 59, 48, 0.1)', padding: 16, borderRadius: 16, gap: 12, borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.2)' },
  
  personaCard: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 20, width: 220, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginRight: 16 },
  personaCardActive: { borderColor: COLORS.gold, backgroundColor: 'rgba(212, 175, 55, 0.15)', shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  personaName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  personaDesc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20 },
  
  generateBtn: { paddingVertical: 20, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginTop: 32, marginBottom: 40, overflow: 'hidden', shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },
  generateBtnText: { color: COLORS.black, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
});
