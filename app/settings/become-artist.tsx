import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Image } from 'expo-image';

export default function BecomeArtistScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const profile = useAuthStore(s => s.profile);
  const fetchProfile = useAuthStore(s => s.fetchProfile);
  
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setUploadingImage(true);
      try {
        const filePath = `avatars/${profile?.id}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('images').upload(filePath, decode(result.assets[0].base64), { contentType: 'image/jpeg' });
        
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('images').getPublicUrl(filePath);
        
        // Immediately save it to their profile so it isn't lost if they exit
        await supabase.from('profiles').update({ avatar_url: publicUrlData.publicUrl }).eq('id', profile?.id);
        
        setAvatarUrl(publicUrlData.publicUrl);
        await fetchProfile();
        Alert.alert("Success", "Profile picture added!");
      } catch (e: any) {
        Alert.alert("Upload Error", e.message);
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleUpgrade = async () => {
    if (!avatarUrl) {
      Alert.alert('Profile Picture Required', 'All artists must have a profile picture. Please tap the camera icon to upload one before continuing.');
      return;
    }

    if (!agreed) {
      Alert.alert('Agreement Required', 'You must agree to the terms to become an artist.');
      return;
    }

    if (!session?.user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'artist', avatar_url: avatarUrl })
        .eq('id', session.user.id);

      if (error) throw error;

      await fetchProfile();

      Alert.alert(
        'Congratulations!', 
        'You are now an Artist! You can start uploading your own music to Bongo Stream.',
        [{ text: 'Start Uploading', onPress: () => router.replace('/upload') }]
      );
    } catch (err: any) {
      Alert.alert('Upgrade Failed', err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role === 'artist') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.black }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <Stack.Screen options={{ headerShown: false }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginLeft: -4 }}>
              <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' }}>Become an Artist</Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.center}>
            <Ionicons name="checkmark-circle" size={80} color={COLORS.gold} />
            <Text style={styles.title}>You are already an {profile.role}!</Text>
            <TouchableOpacity style={styles.submitBtn} onPress={() => router.back()}>
              <Text style={styles.submitBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.black }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginLeft: -4 }}>
              <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' }}>Become an Artist</Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.iconContainer}>
            <Ionicons name="mic" size={60} color={COLORS.gold} />
            <Text style={styles.title}>Upload Your Music</Text>
            <Text style={styles.subtitle}>
              Share your talent with the world. Upgrading to an Artist account is completely free and allows you to publish your own songs to Bongo Stream.
            </Text>
          </View>

          {/* Profile Picture Requirement */}
          <View style={styles.avatarSection}>
            <Text style={styles.avatarTitle}>Artist Profile Picture</Text>
            <Text style={styles.avatarSubtitle}>A profile picture is required to be an artist so fans can recognize you.</Text>
            
            <TouchableOpacity style={styles.avatarWrap} onPress={handlePickImage} disabled={uploadingImage || loading}>
              {uploadingImage ? (
                <View style={[styles.avatarPlaceholder, { backgroundColor: 'transparent' }]}>
                  <ActivityIndicator size="large" color={COLORS.gold} />
                </View>
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={48} color={COLORS.textSecondary} />
                </View>
              )}
              
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={16} color={COLORS.black} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.termsBox}>
            <Text style={styles.termsTitle}>Artist Agreement</Text>
            <Text style={styles.termsText}>
              1. I confirm that I own the rights to all music I upload.{"\n"}
              2. I will not upload copyrighted material without permission.{"\n"}
              3. I understand that Bongo Stream reserves the right to remove content that violates these terms.
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.checkboxRow} 
            onPress={() => setAgreed(!agreed)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
              {agreed && <Ionicons name="checkmark" size={16} color={COLORS.black} />}
            </View>
            <Text style={styles.checkboxText}>I agree to the Artist Terms & Conditions</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.submitBtn, (!agreed || !avatarUrl || loading) && styles.submitBtnDisabled]} 
            onPress={handleUpgrade}
            disabled={!agreed || !avatarUrl || loading}
          >
            <Text style={styles.submitBtnText}>
              {loading 
                ? 'Upgrading...' 
                : !avatarUrl 
                  ? 'Upload Photo to Continue'
                  : !agreed 
                    ? 'Agree to Terms'
                    : 'Upgrade My Account'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: COLORS.card,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 10,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  avatarSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 24,
  },
  avatarTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  avatarSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarImg: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.gold,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#111',
  },
  termsBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 24,
  },
  termsTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  termsText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.divider,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  checkboxText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: COLORS.gold,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '800',
  },
});
