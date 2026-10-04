// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassBackButton from '../../components/GlassBackButton';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

export default function PublishScreen() {
  const router = useRouter();
  const { beatId, vocalUri, beatTitle } = useLocalSearchParams<{ beatId: string; vocalUri: string; beatTitle: string }>();
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const insets = useSafeAreaInsets();
  const session = useAuthStore(s => s.session);

  const [title, setTitle] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your track.');
      return;
    }
    if (!session?.user) {
      Alert.alert('Login Required', 'You must be logged in to publish.');
      return;
    }

    setIsPublishing(true);
    try {
      // 1. Read vocal file
      const fileExt = vocalUri.split('.').pop() || 'm4a';
      const fileName = `vocal_${session.user.id}_${Date.now()}.${fileExt}`;
      const filePath = `vocals/${fileName}`; // Save in 'audio' bucket under 'vocals/' folder

      const fileData = await FileSystem.readAsStringAsync(vocalUri, { encoding: FileSystem.EncodingType.Base64 });
      const arrayBuffer = decode(fileData);

      // 2. Upload to Supabase Storage (assuming bucket is 'audio' based on other parts of the app)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filePath, arrayBuffer, {
          contentType: `audio/${fileExt}`,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('audio').getPublicUrl(filePath);
      const audioUrl = publicUrlData.publicUrl;

      // 3. Insert into tracks table
      const { error: insertError } = await supabase.from('tracks').insert({
        user_id: session.user.id,
        title: title.trim(),
        artist_name: useAuthStore.getState().profile?.display_name || 'Unknown Artist',
        genre: 'Remix',
        audio_url: audioUrl, // This holds the vocal stem
        parent_beat_id: beatId, // This links it to the original beat
        duration_sec: 0, // Ideally we would measure this, but 0 is safe for now
        is_public: true,
      });

      if (insertError) throw insertError;

      Alert.alert('Success', 'Your track has been published!', [
        { text: 'Awesome', onPress: () => router.navigate('/') }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred while publishing.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <GlassBackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Publish Track</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Track Title</Text>
        <TextInput
          style={styles.input}
          placeholder="My awesome remix..."
          placeholderTextColor={COLORS.textTertiary}
          value={title}
          onChangeText={setTitle}
        />
        
        <Text style={styles.infoText}>This will be published as a vocal remix over "{beatTitle}".</Text>

        <TouchableOpacity 
          style={[styles.publishBtn, isPublishing && { opacity: 0.7 }]} 
          onPress={handlePublish}
          disabled={isPublishing}
        >
          {isPublishing ? (
            <ActivityIndicator color={COLORS.black} />
          ) : (
            <Text style={styles.publishBtnText}>Publish Now</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  content: { padding: 24, marginTop: 20 },
  label: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  input: { backgroundColor: COLORS.card, color: COLORS.textPrimary, padding: 16, borderRadius: 12, fontSize: 16, marginBottom: 24 },
  infoText: { color: COLORS.textTertiary, fontSize: 13, marginBottom: 32, fontStyle: 'italic' },
  publishBtn: { backgroundColor: COLORS.gold, padding: 16, borderRadius: 12, alignItems: 'center' },
  publishBtnText: { color: COLORS.black, fontSize: 16, fontWeight: '800' },
});
