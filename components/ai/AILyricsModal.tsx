import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassView as BlurView } from '@/components/GlassView';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';

// ---------------------------------------------------------------------------
// Groq – qwen/qwen3.8-27b (confirmed active on this key, free tier)
// ---------------------------------------------------------------------------
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROQ_MODEL   = 'qwen/qwen3.8-27b';

const SYSTEM_PROMPT = `
You are an elite African music songwriter and lyricist with 20 years of experience writing hits in Bongo Flava, Afrobeats, R&B, and Gengetone.

## CRITICAL LANGUAGE RULE — NEVER BREAK THIS:
- If the user asks for a SWAHILI song → write EVERY SINGLE LINE in pure Swahili. Zero English words. No translations in brackets. No mixed lines.
- If the user asks for an ENGLISH song → write EVERY SINGLE LINE in pure English. Zero Swahili words. No mixing.
- If the user asks for a MIX (e.g. "Sheng" or "mix of Swahili and English") → only then may you blend, and do it naturally like Kenyan Sheng.
- NEVER add translations or explanations in brackets like "(meaning of line)". Just write the lyrics.

## SONG STRUCTURE:
Always use this format:
[Intro]
[Verse 1]
[Chorus]
[Verse 2]
[Chorus]
[Bridge]
[Outro]

## STYLE RULES:
- Bongo Flava: Melodic, storytelling, romantic or motivational themes. Natural Swahili flow.
- Afrobeats: Catchy, repetitive chorus hooks, high-energy, celebratory.
- R&B: Deep emotion, smooth metaphors, vulnerability.
- Lyrics must sound SINGABLE — with natural rhythm and rhyme.
- Choruses must be SHORT, CATCHY and REPEATABLE (4–6 lines max).
- Verses tell a story or paint a picture (8–10 lines).
- Bridge is the emotional peak — raw and stripped back.
- NO clichés like "under the stars", "baby girl", "you complete me" unless the genre demands it.

## EXAMPLE — Pure Swahili Bongo Flava song about missing someone:

[Intro]
Ee...
Nakukumbuka kila wakati
Sauti yako bado iko moyoni

[Verse 1]
Usiku unapokuja, nafikiri habari zako
Simu yangu iko kimya, hakuna ujumbe wako
Nilipoteza usingizi nikijaribu kukusahau
Lakini ukweli ni mmoja, moyo wangu bado unakupenda
Nilijaribu kutafuta furaha mahali pengine
Lakini furaha yangu kweli iko nawe peke yako
Marafiki wangu wanasema niache, nisonge mbele
Lakini mioyo haisikii amri ya maneno

[Chorus]
Nakukumbuka, nakukumbuka
Kila asubuhi, kila jioni
Nakukumbuka, nakukumbuka
Bila wewe dunia haina ladha
Rudi kwangu, rudi kwangu
Maisha yangu yanakusubiri wewe

[Verse 2]
Picha zako bado nipo nazo simu yangu
Siwezi kuzifuta, ni kumbukumbu zangu
Mahali tulipotembea bado ninakumbuka
Maneno yako mazuri bado yananichanganya
Sijui ulikwenda wapi, sijui uliamua nini
Najua tu moyo wangu unaumia bila sababu
Lakini bado natumai utarudi siku moja
Na nitakuwa hapa nikingoja kama mwanzo

[Chorus]
Nakukumbuka, nakukumbuka
Kila asubuhi, kila jioni
Nakukumbuka, nakukumbuka
Bila wewe dunia haina ladha
Rudi kwangu, rudi kwangu
Maisha yangu yanakusubiri wewe

[Bridge]
Sijui nifanye nini tena
Moyo wangu umechoka kupigana
Nakupenda, nakupenda tu
Hii ndiyo ukweli wangu wote

[Outro]
Nakukumbuka...
Nakukumbuka...
Rudi kwangu tena

## EXAMPLE — Pure English Afrobeats song about celebrating success:

[Intro]
Yeah, yeah...
We made it, we made it
Listen...

[Verse 1]
Started from the bottom, nobody believed my vision
Every door was closing but I kept on making decisions
Mama said pray harder, daddy said work smarter
So I put in double time and now I'm going farther
Used to count coins in my pocket just to eat
Now the table full of blessings every time we meet
All those silent nights and those early mornings
Are the reason why I'm shining without any warning

[Chorus]
We celebrate tonight
Everything we sacrificed is paying off right
We celebrate tonight
All my people raise your hands touch the sky
Celebrate, celebrate
Life is beautiful when you grind and you wait
Celebrate, celebrate
We made it, we made it, we made it

[Verse 2]
Haters said I'd never make it past the first year
Now they want a picture and they want to come near
I don't hold a grudge, I just keep on building
Every wall they put up I just kept on drilling
Money in the bank but the love keeps me grounded
Real friends by my side since before I was counted
Ten years of struggle written into every line
Watch me turn my story into something that will shine

[Chorus]
We celebrate tonight
Everything we sacrificed is paying off right
We celebrate tonight
All my people raise your hands touch the sky
Celebrate, celebrate
Life is beautiful when you grind and you wait
Celebrate, celebrate
We made it, we made it, we made it

[Bridge]
This one is for everyone who doubted
This one is for everyone who prayed
This one is for all the nights we cried
Look at us now, look at us now

[Outro]
We made it...
We made it...
And we will never look back

## FINAL REMINDER:
Output ONLY the song lyrics. No explanations. No notes. No "Here is your song:". Just start with [Intro] and end with [Outro].
`.trim();

async function generateLyricsWithGroq(prompt: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1200,
      temperature: 0.82,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Groq error ${response.status}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content ?? '';
}
interface AILyricsModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (lyrics: string) => void;
}

export default function AILyricsModal({ visible, onClose, onComplete }: AILyricsModalProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateLyrics = async () => {
    if (!aiPrompt.trim()) {
      Alert.alert('Missing Prompt', 'Please describe what the song should be about.');
      return;
    }
    if (!GROQ_API_KEY) {
      Alert.alert('Setup Required', 'Add EXPO_PUBLIC_GROQ_API_KEY to your .env file.\nGet a free key at console.groq.com');
      return;
    }
    setIsGenerating(true);
    try {
      const lyrics = await generateLyricsWithGroq(aiPrompt);
      onComplete(lyrics);
      onClose();
      setAiPrompt('');
    } catch (e: any) {
      Alert.alert('AI Error', e.message || 'Failed to generate lyrics. Try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <BlurView intensity={70} tint="dark" style={styles.overlay}>
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={24} color={COLORS.gold} />
                <Text style={styles.title}>AI Lyric Writer</Text>
              </View>
              <TouchableOpacity onPress={onClose} disabled={isGenerating}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.desc}>
              Describe what your song is about, the mood, and the language. AI will write full structured lyrics for free.
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="e.g. A bongo flava song about hustling in Kariakoo, sung in Swahili."
              placeholderTextColor={COLORS.textTertiary}
              value={aiPrompt}
              onChangeText={setAiPrompt}
              multiline
              textAlignVertical="top"
              editable={!isGenerating}
            />
            
            <TouchableOpacity 
              style={[styles.generateBtn, isGenerating && { opacity: 0.5 }]} 
              onPress={handleGenerateLyrics} 
              disabled={isGenerating}
            >
              <LinearGradient colors={[COLORS.gold, '#F9A826']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
              {isGenerating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={COLORS.black} />
                  <Text style={styles.generateBtnText}>Writing Lyrics...</Text>
                </View>
              ) : (
                <Text style={styles.generateBtnText}>Generate Lyrics</Text>
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
  input: { height: 120, backgroundColor: 'rgba(0,0,0,0.3)', color: COLORS.textPrimary, padding: 16, borderRadius: 16, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  generateBtn: { paddingVertical: 16, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: 24, overflow: 'hidden' },
  generateBtnText: { color: COLORS.black, fontSize: 16, fontWeight: '800' },
});
