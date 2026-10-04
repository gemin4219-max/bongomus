import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Image } from 'expo-image';

export default function EditProfileSettings() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const profile = useAuthStore(s => s.profile);
  const router = useRouter();
  const { t } = useTranslation();
  
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [saving, setSaving] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setSaving(true);
      try {
        const filePath = `avatars/${profile?.id}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('images').upload(filePath, decode(result.assets[0].base64), { contentType: 'image/jpeg' });
        
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('images').getPublicUrl(filePath);
        setAvatarUrl(publicUrlData.publicUrl);
        Alert.alert("Success", "Profile picture uploaded successfully!");
      } catch (e: any) {
        Alert.alert("Upload Error", e.message);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      display_name: displayName,
      bio,
      location,
      avatar_url: avatarUrl
    }).eq('id', profile.id);
    
    setSaving(false);
    if (error) {
      Alert.alert(t('upload.error'), error.message);
    } else {
      useAuthStore.getState().fetchProfile();
      router.back();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.black }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginLeft: -4 }}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('profile.edit_profile')}</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
        
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
        <TouchableOpacity onPress={handlePickImage} disabled={saving}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 100, height: 100, borderRadius: 50 }} />
          ) : (
            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.cardAlt, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="person" size={50} color={COLORS.textTertiary} />
            </View>
          )}
          <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.gold, padding: 8, borderRadius: 20 }}>
            <Ionicons name="camera" size={16} color={COLORS.black} />
          </View>
        </TouchableOpacity>
      </View>
      <Text style={styles.label}>Display Name</Text>
      <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholderTextColor={COLORS.textTertiary} />
      
      <Text style={styles.label}>Bio</Text>
      <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={bio} onChangeText={setBio} multiline placeholderTextColor={COLORS.textTertiary} />
      
      <Text style={styles.label}>Location</Text>
      <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholderTextColor={COLORS.textTertiary} />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.saveBtnText}>{t('settings.save')}</Text>}
      </TouchableOpacity>

      {profile?.role !== 'artist' && profile?.role !== 'admin' && (
        <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/settings/become-artist')}>
          <Ionicons name="star" size={20} color={COLORS.gold} />
          <Text style={styles.upgradeBtnText}>Upgrade to Artist Account</Text>
        </TouchableOpacity>
      )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', padding: 16 },
  label: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: COLORS.card, color: COLORS.textPrimary, borderRadius: 12, padding: 14, fontSize: 15 },
  saveBtn: { backgroundColor: COLORS.gold, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 32 },
  saveBtnText: { color: COLORS.black, fontWeight: 'bold', fontSize: 16 },
  upgradeBtn: { backgroundColor: 'transparent', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: COLORS.gold },
  upgradeBtnText: { color: COLORS.gold, fontWeight: 'bold', fontSize: 16 }
});
