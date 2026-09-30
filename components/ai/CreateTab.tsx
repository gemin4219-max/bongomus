import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../../lib/supabase';
import { generateMusic } from '../../lib/sunoApi';
import { useAIStore } from '../../store/aiStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import AudioRecorder from './AudioRecorder';


interface CreateTabProps {
  onGenerateSuccess: () => void;
  openLyricsModal: (onComplete: (lyrics: string) => void) => void;
}

export default function CreateTab({ onGenerateSuccess, openLyricsModal }: CreateTabProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  
  const [title, setTitle] = useState('');
  const [style, setStyle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [isLyricsFullscreen, setIsLyricsFullscreen] = useState(false);
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [vocalGender, setVocalGender] = useState<'Male' | 'Female' | 'Any'>('Any');
  const [weirdness, setWeirdness] = useState<number>(50);
  const [styleInfluence, setStyleInfluence] = useState<number>(50);
  
  const [isGenerating, setIsGenerating] = useState(false);

  const { addTask, personas } = useAIStore();
  const { session, profile } = useAuthStore();
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const handleGenerate = async () => {
    // If a persona is selected, default missing fields so it's easier to generate
    const finalTitle = title.trim() || (selectedPersona ? "My Custom Song" : "");
    const finalStyle = style.trim() || (selectedPersona ? "Pop, vocal" : "");
    const finalLyrics = lyrics.trim();

    const missing = [];
    if (!finalTitle) missing.push('title');
    if (!finalStyle) missing.push('style');
    if (!finalLyrics) missing.push('lyrics');

    if (missing.length > 0) {
      setMissingFields(missing);
      Alert.alert("Missing Fields", "Please fill out title, style, and lyrics.");
      return;
    }
    
    setMissingFields([]);
    
    const requiredCredits = 1;

    if ((profile?.credits || 0) < requiredCredits) {
      Alert.alert(
        "Not Enough Credits", 
        `You need ${requiredCredits} credit${requiredCredits > 1 ? 's' : ''} to generate this song.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Buy Credits", onPress: () => router.push('/buy-credits') }
        ]
      );
      return;
    }
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.rpc('deduct_credits', { user_id: profile?.id, amount: requiredCredits });
      if (error || data === false) {
        const { error: fallbackError } = await supabase
          .from('profiles')
          .update({ credits: (profile?.credits || 0) - requiredCredits })
          .eq('id', profile?.id);
          
        if (fallbackError) {
          throw new Error(`Failed to deduct credits: ${fallbackError.message}`);
        }
      }
      
      const isVoicePersona = personas.find(p => p.id === selectedPersona)?.description === "Custom Voice Clone";
      const taskId = await generateMusic(finalLyrics, finalStyle, finalTitle, null, vocalGender, weirdness, styleInfluence, selectedPersona || undefined, isVoicePersona);
      
      addTask(taskId, finalTitle);
      
      setTitle('');
      setStyle('');
      setLyrics('');
      
      if (session?.user.id) useAuthStore.getState().fetchProfile(session.user.id);
      
      onGenerateSuccess();
    } catch (e: any) {
      // 1. Tell user to try later
      Alert.alert("Notice", "The AI studio is currently busy. Please try again later. Your credit has been refunded.");
      
      // 2. Notify admin (log to database)
      try {
        await supabase.from('admin_error_logs').insert({
          error_message: e.message || 'Unknown error',
          user_id: profile?.id,
          context: 'AI Music Generation (CreateTab)',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error("Failed to log admin error", logErr);
      }

      // 3. Refund credits since generation failed
      try {
        const { error: refundError } = await supabase.rpc('deduct_credits', { user_id: profile?.id, amount: -requiredCredits });
        if (refundError) {
          // Fallback if rpc fails
          await supabase
            .from('profiles')
            .update({ credits: (profile?.credits || 0) + requiredCredits })
            .eq('id', profile?.id);
        }
        if (session?.user.id) useAuthStore.getState().fetchProfile(session.user.id);
      } catch (err) {
        console.error("Failed to refund credits", err);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      {(profile?.credits || 0) <= 2 && (
        <TouchableOpacity style={styles.lowCreditBanner} onPress={() => router.push('/buy-credits')}>
          <LinearGradient colors={['#FF3B30', '#FF9500']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
          <Ionicons name="alert-circle" size={24} color={COLORS.black} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.lowCreditTitle}>Running Low on Credits!</Text>
            <Text style={styles.lowCreditSub}>You only have {profile?.credits || 0} credits left. Tap here to refill.</Text>
          </View>
        </TouchableOpacity>
      )}

      <Text style={styles.label}>Song Title</Text>
      <View style={[styles.inputRow, missingFields.includes('title') && { borderColor: '#FF3B30' }]}>
        <Ionicons name="text-outline" size={20} color={COLORS.gold} />
        <TextInput style={styles.input} placeholder="e.g. Midnight Memories" placeholderTextColor={COLORS.textTertiary} value={title} onChangeText={(t) => { setTitle(t); setMissingFields(m => m.filter(f => f !== 'title')); }} />
      </View>
      
      <View style={[styles.inputRow, { marginTop: 16 }, missingFields.includes('style') && { borderColor: '#FF3B30' }]}>
        <Ionicons name="musical-notes-outline" size={20} color={COLORS.gold} />
        <TextInput style={styles.input} placeholder="e.g. Acoustic pop, upbeat" placeholderTextColor={COLORS.textTertiary} value={style} onChangeText={(t) => { setStyle(t); setMissingFields(m => m.filter(f => f !== 'style')); }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginBottom: 4 }}>
        {['Bongo Flava', 'Amapiano', 'Afrobeats', 'R&B', 'Gospel', 'Hip Hop'].map((s) => (
          <TouchableOpacity 
            key={s} 
            style={[styles.personaPill, style.includes(s) && styles.personaPillActive]}
            onPress={() => {
              if (style.includes(s)) {
                setStyle(style.replace(s, '').replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',').trim());
              } else {
                setStyle(style ? `${style}, ${s}` : s);
              }
              setMissingFields(m => m.filter(f => f !== 'style'));
            }}
          >
            <Text style={[styles.personaPillText, style.includes(s) && styles.personaPillTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.label, { marginTop: 0, marginBottom: 0, marginRight: 8 }]}>Lyrics</Text>
          <TouchableOpacity onPress={() => setIsLyricsFullscreen(true)} style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
            <Ionicons name="expand" size={16} color={COLORS.gold} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.autoWriteBtn} onPress={() => openLyricsModal(setLyrics)}>
          <LinearGradient colors={['#FFD700', '#D4AF37', '#B8860B']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={[StyleSheet.absoluteFill, { borderRadius: 16, opacity: 0.9 }]} />
          <Ionicons name="sparkles" size={14} color={COLORS.black} />
          <Text style={styles.autoWriteText}>Auto-Write AI (Free)</Text>
        </TouchableOpacity>
      </View>
      
      <TextInput style={[styles.input, styles.textArea, missingFields.includes('lyrics') && { borderColor: '#FF3B30' }]} placeholder="Write your verses and chorus here..." placeholderTextColor={COLORS.textTertiary} value={lyrics} onChangeText={(t) => { setLyrics(t); setMissingFields(m => m.filter(f => f !== 'lyrics')); }} multiline textAlignVertical="top" />

      <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced(!showAdvanced)} activeOpacity={0.7}>
        <Text style={styles.advancedToggleText}>Advanced Options</Text>
        <Ionicons name={showAdvanced ? "chevron-up" : "chevron-down"} size={20} color={COLORS.gold} />
      </TouchableOpacity>

      {showAdvanced && (
        <View style={styles.advancedContainer}>
          {personas.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={[styles.label, { marginTop: 0 }]}>Use Custom Voice Persona</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <TouchableOpacity 
                  style={[styles.personaPill, !selectedPersona && styles.personaPillActive]}
                  onPress={() => setSelectedPersona(null)}
                >
                  <Text style={[styles.personaPillText, !selectedPersona && styles.personaPillTextActive]}>None</Text>
                </TouchableOpacity>
                {personas.map(p => (
                  <TouchableOpacity 
                    key={p.id}
                    style={[styles.personaPill, selectedPersona === p.id && styles.personaPillActive]}
                    onPress={() => setSelectedPersona(p.id)}
                  >
                    <Ionicons name="mic" size={14} color={selectedPersona === p.id ? COLORS.black : COLORS.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={[styles.personaPillText, selectedPersona === p.id && styles.personaPillTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={[styles.label, { marginTop: 0 }]}>Vocal Gender</Text>
          <View style={styles.genderRow}>
            {['Male', 'Female', 'Any'].map(g => (
              <TouchableOpacity 
                key={g} 
                style={[styles.genderBtn, vocalGender === g && styles.genderBtnActive]}
                onPress={() => setVocalGender(g as any)}
              >
                <Text style={[styles.genderText, vocalGender === g && styles.genderTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 24 }]}>Weirdness: {weirdness}%</Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={weirdness}
            onValueChange={setWeirdness}
            minimumTrackTintColor={COLORS.gold}
            maximumTrackTintColor={COLORS.divider}
            thumbTintColor={COLORS.gold}
          />
          <Text style={{ color: COLORS.textTertiary, fontSize: 12, marginBottom: 8 }}>Controls the variance and creative liberty of the generation.</Text>

          <Text style={[styles.label, { marginTop: 16 }]}>Style Influence: {styleInfluence}%</Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={styleInfluence}
            onValueChange={setStyleInfluence}
            minimumTrackTintColor={COLORS.gold}
            maximumTrackTintColor={COLORS.divider}
            thumbTintColor={COLORS.gold}
          />
          <Text style={{ color: COLORS.textTertiary, fontSize: 12 }}>How strictly the AI follows the genre prompts.</Text>
        </View>
      )}

      <TouchableOpacity style={[styles.generateBtn, isGenerating && { opacity: 0.7 }]} onPress={handleGenerate} disabled={isGenerating}>
        <LinearGradient colors={[COLORS.gold, '#F9A826']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
        {isGenerating ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={COLORS.black} />
            <Text style={styles.generateBtnText}>Composing...</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="musical-notes" size={20} color={COLORS.black} />
            <Text style={styles.generateBtnText}>Generate with AI (1 Credit)</Text>
          </View>
        )}
      </TouchableOpacity>

      
    </ScrollView>

      {/* Fullscreen Lyrics Input Modal */}
      <Modal visible={isLyricsFullscreen} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(10,10,12,0.98)', paddingTop: 50 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 }}>
              <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' }}>Custom Lyrics</Text>
              <TouchableOpacity onPress={() => setIsLyricsFullscreen(false)} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 24 }}>
                <Ionicons name="contract" size={24} color={COLORS.gold} />
              </TouchableOpacity>
            </View>
            <TextInput 
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', color: COLORS.textPrimary, padding: 24, fontSize: 16, textAlignVertical: 'top' }}
              placeholder="Write your verses and chorus here..."
              placeholderTextColor={COLORS.textTertiary}
              value={lyrics}
              onChangeText={(t) => { setLyrics(t); }}
              multiline
              autoFocus
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1 },
  label: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 24, letterSpacing: 0.5, textTransform: 'uppercase' },
  autoWriteBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, gap: 6, overflow: 'hidden', shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  autoWriteText: { color: COLORS.black, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' },
  input: { flex: 1, color: COLORS.textPrimary, paddingVertical: 16, borderRadius: 16, fontSize: 15 },
  textArea: { height: 180, backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' },
  advancedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 16, marginTop: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  advancedToggleText: { color: COLORS.gold, fontSize: 15, fontWeight: '700' },
  advancedContainer: { backgroundColor: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 16, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.02)' },
  
  lowCreditBanner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
  lowCreditTitle: { color: COLORS.black, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  lowCreditSub: { color: COLORS.black, fontSize: 13, fontWeight: '600' },
  
  uploadBtn: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  uploadBtnText: { color: COLORS.gold, fontWeight: '700', fontSize: 14 },
  
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  personaCard: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, width: 220, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginRight: 16, marginTop: 8 },
  personaCardActive: { borderColor: COLORS.gold, backgroundColor: 'rgba(212, 175, 55, 0.1)' },
  personaName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  personaDesc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20 },
  
  genderRow: { flexDirection: 'row', gap: 10 },
  genderBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  genderBtnActive: { backgroundColor: 'rgba(212, 175, 55, 0.15)', borderColor: COLORS.gold },
  genderText: { color: COLORS.textSecondary, fontWeight: '700' },
  genderTextActive: { color: COLORS.gold },
  
  generateBtn: { paddingVertical: 20, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginTop: 32, marginBottom: 40, overflow: 'hidden', shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },
  generateBtnText: { color: COLORS.black, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  
  personaPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.03)', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  personaPillActive: { backgroundColor: 'rgba(212, 175, 55, 0.15)', borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  personaPillText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  personaPillTextActive: { color: COLORS.gold, fontWeight: '800' },

  buyCreditsInlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 16, borderRadius: 30, marginBottom: 40, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  buyCreditsInlineText: { color: COLORS.gold, fontSize: 15, fontWeight: '700' },
});

