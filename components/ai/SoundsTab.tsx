// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../../lib/supabase';
import { generateSounds } from '../../lib/sunoApi';
import { useAIStore } from '../../store/aiStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';


interface SoundsTabProps {
  onGenerateSuccess: () => void;
}

export default function SoundsTab({ onGenerateSuccess }: SoundsTabProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  
  const [prompt, setPrompt] = useState('');
  const [isLooping, setIsLooping] = useState(false);
  const [tempo, setTempo] = useState('');
  const [key, setKey] = useState('');
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const { addTask } = useAIStore();
  const { session, profile } = useAuthStore();

  const handleGenerate = async () => {
    if (!prompt) {
      Alert.alert("Missing Fields", "Please describe the sound you want to generate.");
      return;
    }
    
    const requiredCredits = 1;

    if ((profile?.credits || 0) < requiredCredits) {
      Alert.alert(
        "Not Enough Credits", 
        `You need ${requiredCredits} credit to generate this sound.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Buy Credits", onPress: () => router.push('/buy-credits') }
        ]
      );
      return;
    }
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.rpc('deduct_credits', { user_id: session?.user.id, amount: requiredCredits });
      if (error || !data) throw new Error("Failed to deduct credits");
      
      const taskId = await generateSounds(
        prompt, 
        isLooping, 
        tempo ? tempo : undefined, 
        key ? key : undefined
      );
      
      addTask(taskId, prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '') + ' (Sound)');
      
      setPrompt('');
      setIsLooping(false);
      setTempo('');
      setKey('');
      
      if (session?.user.id) useAuthStore.getState().fetchProfile(session.user.id);
      
      onGenerateSuccess();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
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

      <Text style={styles.label}>Sound Description (Prompt)</Text>
      <TextInput 
        style={[styles.input, styles.textArea]} 
        placeholder="e.g. A soft rain ambience with distant thunder and gentle wind" 
        placeholderTextColor={COLORS.textTertiary} 
        value={prompt} 
        onChangeText={setPrompt} 
        multiline 
        textAlignVertical="top" 
      />
      
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Seamless Loop</Text>
          <Text style={styles.switchSub}>Generate a sound that can loop forever</Text>
        </View>
        <Switch 
          value={isLooping} 
          onValueChange={setIsLooping} 
          trackColor={{ false: 'rgba(255,255,255,0.1)', true: COLORS.gold }}
          thumbColor={COLORS.white}
        />
      </View>

      {/* Advanced Options Toggle */}
      <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced(!showAdvanced)} activeOpacity={0.7}>
        <Text style={styles.advancedToggleText}>Advanced Options</Text>
        <Ionicons name={showAdvanced ? "chevron-up" : "chevron-down"} size={20} color={COLORS.gold} />
      </TouchableOpacity>

      {showAdvanced && (
        <View style={styles.advancedContainer}>
          <Text style={styles.label}>Tempo (BPM)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. 120" 
            placeholderTextColor={COLORS.textTertiary} 
            value={tempo} 
            onChangeText={setTempo} 
            keyboardType="numeric"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Musical Key</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. C minor, F# major" 
            placeholderTextColor={COLORS.textTertiary} 
            value={key} 
            onChangeText={setKey} 
          />
        </View>
      )}

      <TouchableOpacity style={[styles.generateBtn, isGenerating && { opacity: 0.7 }]} onPress={handleGenerate} disabled={isGenerating}>
        <LinearGradient colors={[COLORS.gold, '#F9A826']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
        {isGenerating ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={COLORS.black} />
            <Text style={styles.generateBtnText}>Generating Sound...</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="musical-notes" size={20} color={COLORS.black} />
            <Text style={styles.generateBtnText}>Generate Sound (1 Credit)</Text>
          </View>
        )}
      </TouchableOpacity>

      
    </ScrollView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1 },
  label: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 24, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: { backgroundColor: 'rgba(255,255,255,0.03)', color: COLORS.textPrimary, padding: 16, borderRadius: 16, fontSize: 15, borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' },
  textArea: { height: 140 },
  
  switchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, marginTop: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' },
  switchLabel: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  switchSub: { color: COLORS.textTertiary, fontSize: 12 },
  
  advancedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 16, marginTop: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  advancedToggleText: { color: COLORS.gold, fontSize: 15, fontWeight: '700' },
  advancedContainer: { backgroundColor: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 16, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.02)' },
  
  lowCreditBanner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
  lowCreditTitle: { color: COLORS.black, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  lowCreditSub: { color: COLORS.black, fontSize: 13, fontWeight: '600' },
  
  generateBtn: { paddingVertical: 20, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginTop: 32, marginBottom: 40, overflow: 'hidden', shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },
  generateBtnText: { color: COLORS.black, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  buyCreditsInlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 16, borderRadius: 30, marginBottom: 40, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  buyCreditsInlineText: { color: COLORS.gold, fontSize: 15, fontWeight: '700' },
});

