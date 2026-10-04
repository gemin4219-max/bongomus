import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

import { supabase } from '../../lib/supabase';

export default function VerifyScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const profile = useAuthStore(s => s.profile);
  const router = useRouter();
  
  const [socialLinks, setSocialLinks] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  const hasFollowers = (profile?.follower_count || 0) >= 30;
  const hasSongs = (profile?.track_count || 0) >= 5;
  const hasName = !!profile?.display_name?.trim();
  const hasBio = !!profile?.bio?.trim();
  
  const isEligible = hasFollowers && hasSongs && hasName && hasBio;

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('verification_requests')
        .select('status')
        .eq('user_id', profile.id)
        .single();
        
      if (data) {
        setStatus(data.status);
      }
    } catch (e) {
      console.log("No existing request found.");
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async () => {
    if (!profile) return;
    if (!socialLinks.trim()) {
      Alert.alert("Required", "Please provide links to your social media or artist profiles.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('verification_requests').insert({
      user_id: profile.id,
      social_links: socialLinks,
      status: 'pending'
    });

    setLoading(false);

    if (error) {
      if (error.code === '23505') {
        Alert.alert("Already Applied", "You already have a pending verification request.");
        setStatus('pending');
      } else {
        Alert.alert("Error", error.message);
      }
    } else {
      Alert.alert("Success", "Your verification request has been submitted and is under review.");
      setStatus('pending');
    }
  };

  if (fetching) {
    return (
      <View style={styles.center}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.black }]} />
        <Stack.Screen options={{ title: 'Get Verified', headerShown: true, headerTransparent: true, headerTintColor: COLORS.gold, }} />
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.black }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginLeft: -4 }}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' }}>Get Verified</Text>
          <View style={{ width: 28 }} />
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, paddingBottom: 50 }}>
          
          <View style={styles.headerArea}>
          <Ionicons name="checkmark-circle" size={80} color={COLORS.gold} />
          <Text style={styles.title}>Artist Verification</Text>
          <Text style={styles.subtitle}>
            Get the official verified tick next to your name. Show your fans that you are authentic.
          </Text>
        </View>

        {!isEligible && !profile?.is_verified && status !== 'pending' && status !== 'rejected' ? (
          <View style={styles.eligibilityBox}>
            <Text style={styles.eligibilityTitle}>Eligibility Requirements</Text>
            <Text style={styles.eligibilitySub}>You must meet all requirements before applying for verification.</Text>
            
            <View style={styles.reqList}>
              <ReqItem met={hasFollowers} text={`Have 30+ followers (${profile?.follower_count || 0}/30)`} />
              <ReqItem met={hasSongs} text={`Have 5+ public songs (${profile?.track_count || 0}/5)`} />
              <ReqItem met={hasName} text="Set a Display Name" />
              <ReqItem met={hasBio} text="Write a Profile Bio" />
            </View>
            
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: COLORS.cardAlt }]} disabled={true}>
              <Text style={[styles.submitBtnText, { color: COLORS.textTertiary }]}>Not Eligible Yet</Text>
            </TouchableOpacity>
          </View>
        ) : profile?.is_verified ? (
          <View style={styles.statusBox}>
            <Ionicons name="checkmark-done-circle" size={40} color={COLORS.gold} />
            <Text style={styles.statusText}>You are already verified!</Text>
          </View>
        ) : status === 'pending' ? (
          <View style={[styles.statusBox, { backgroundColor: 'rgba(255,184,48,0.1)' }]}>
            <Ionicons name="time-outline" size={40} color={COLORS.gold} />
            <Text style={styles.statusText}>Your request is currently under review. Please wait up to 48 hours.</Text>
          </View>
        ) : status === 'rejected' ? (
          <View style={[styles.statusBox, { backgroundColor: 'rgba(255,82,82,0.1)' }]}>
            <Ionicons name="close-circle-outline" size={40} color={COLORS.error} />
            <Text style={[styles.statusText, { color: COLORS.error }]}>Your previous request was not approved.</Text>
            <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginTop: 10 }}>You can re-apply by updating your information below.</Text>
            
            <Text style={styles.label}>Social Media Links & Portfolio</Text>
            <TextInput 
              style={[styles.input, { height: 120 }]} 
              placeholder="Instagram, YouTube, Spotify links..."
              placeholderTextColor={COLORS.textTertiary}
              multiline
              value={socialLinks}
              onChangeText={setSocialLinks}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.submitBtnText}>Re-Submit Application</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.label}>Social Media Links & Portfolio</Text>
            <Text style={styles.helpText}>Please provide links to your active social media accounts (Instagram, TikTok) or existing music platforms (Spotify, YouTube) to help us verify your identity.</Text>
            
            <TextInput 
              style={styles.input} 
              placeholder="e.g. https://instagram.com/myprofile"
              placeholderTextColor={COLORS.textTertiary}
              multiline
              value={socialLinks}
              onChangeText={setSocialLinks}
              textAlignVertical="top"
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.submitBtnText}>Submit Application</Text>}
            </TouchableOpacity>
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function ReqItem({ met, text }: { met: boolean; text: string }) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  return (
    <View style={styles.reqItem}>
      <Ionicons 
        name={met ? "checkmark-circle" : "close-circle"} 
        size={20} 
        color={met ? COLORS.gold : COLORS.textTertiary} 
      />
      <Text style={[styles.reqText, met && { color: COLORS.textPrimary }]}>{text}</Text>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  center: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: 'transparent' },
  headerArea: { alignItems: 'center', marginBottom: 40, marginTop: 20 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
  label: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 6, marginTop: 20 },
  helpText: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 16, lineHeight: 20 },
  input: { backgroundColor: COLORS.card, color: COLORS.textPrimary, borderRadius: 12, padding: 16, fontSize: 15, minHeight: 120, borderWidth: 1, borderColor: COLORS.divider },
  submitBtn: { backgroundColor: COLORS.gold, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 32 },
  submitBtnText: { color: COLORS.black, fontWeight: 'bold', fontSize: 16 },
  statusBox: { alignItems: 'center', backgroundColor: COLORS.card, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: COLORS.divider },
  statusText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 16, lineHeight: 24 },
  
  eligibilityBox: { backgroundColor: COLORS.card, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: COLORS.divider },
  eligibilityTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  eligibilitySub: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 20, lineHeight: 20 },
  reqList: { gap: 12 },
  reqItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reqText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '500' }
});
