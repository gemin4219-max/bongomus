import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

export default function PairPartnerScreen() {
  const { COLORS, theme } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const profile = useAuthStore(s => s.profile);
  const fetchProfile = useAuthStore(s => s.fetchProfile);
  
  const [searchUsername, setSearchUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);

  useEffect(() => {
    fetchRequests();
    if (profile?.partner_id) {
      fetchPartnerProfile(profile.partner_id);
    }
  }, [profile?.partner_id]);

  const fetchPartnerProfile = async (id: string) => {
    const { data } = await supabase.from('profiles').select('username, display_name').eq('id', id).single();
    if (data) setPartnerProfile(data);
  };

  const fetchRequests = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('pairing_requests')
      .select('*, sender:profiles!pairing_requests_sender_id_fkey(username, display_name), receiver:profiles!pairing_requests_receiver_id_fkey(username, display_name)')
      .eq('status', 'pending');
      
    if (data) {
      setPendingRequests(data.filter(r => r.receiver_id === profile.id));
      setSentRequests(data.filter(r => r.sender_id === profile.id));
    }
  };

  const handleSendRequest = async () => {
    if (!searchUsername) return;
    setLoading(true);
    // Find user
    const { data: users, error } = await supabase.rpc('search_users_by_username', { p_username: searchUsername });
    if (error || !users || users.length === 0) {
      Alert.alert('Not Found', 'Could not find a user with that username.');
      setLoading(false);
      return;
    }
    
    const targetUser = users[0];
    if (targetUser.id === profile?.id) {
      Alert.alert('Oops', 'You cannot pair with yourself!');
      setLoading(false);
      return;
    }

    const { error: insertErr } = await supabase
      .from('pairing_requests')
      .insert({ sender_id: profile?.id, receiver_id: targetUser.id });
      
    if (insertErr) {
      Alert.alert('Error', insertErr.message);
    } else {
      Alert.alert('Sent!', `Pairing request sent to @${targetUser.username} 💌`);
      setSearchUsername('');
      fetchRequests();
    }
    setLoading(false);
  };

  const handleAccept = async (requestId: string) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('accept_pairing_request', { p_request_id: requestId });
    if (error || !data) {
      Alert.alert('Error', error?.message || 'Failed to pair.');
    } else {
      Alert.alert('Paired! 💖', 'You are now paired! The Love Theme has been activated.');
      await fetchProfile(); // This will trigger the theme change!
    }
    setLoading(false);
  };

  const handleBreakup = async () => {
    Alert.alert('Break Up?', 'Are you sure you want to unpair your account? You will lose the shared love theme.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, Unpair', style: 'destructive', onPress: async () => {
        setLoading(true);
        await supabase.rpc('unpair_account');
        setPartnerProfile(null);
        await fetchProfile();
        setLoading(false);
      }}
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.black }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginLeft: -4 }}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' }}>Couple Pairing</Text>
          <View style={{ width: 28 }} />
        </View>
        
        <ScrollView contentContainerStyle={styles.content}>
        
        {/* Header Animation / Icon */}
        <View style={styles.headerArea}>
          <View style={styles.iconCircle}>
            <Ionicons name={profile?.partner_id ? "heart" : "heart-half"} size={48} color={theme === 'love' ? COLORS.gold : COLORS.error} />
          </View>
          <Text style={styles.title}>Couple Pairing</Text>
          <Text style={styles.subtitle}>
            {profile?.partner_id 
              ? "You are currently paired! You both share the exclusive Love theme." 
              : "Pair your account with your partner's to unlock the exclusive Love theme across both your devices! 💖"}
          </Text>
        </View>

        {profile?.partner_id ? (
          <View style={styles.pairedCard}>
            <Text style={styles.pairedText}>You are paired with</Text>
            <Text style={styles.partnerName}>@{partnerProfile?.username || 'Loading...'}</Text>
            <TouchableOpacity style={styles.breakupBtn} onPress={handleBreakup}>
              <Text style={styles.breakupText}>Unpair Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Search and Send Request */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Send a Request</Text>
              <TextInput
                style={styles.input}
                placeholder="Partner's @username"
                placeholderTextColor={COLORS.textTertiary}
                value={searchUsername}
                onChangeText={setSearchUsername}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.sendBtn} onPress={handleSendRequest} disabled={loading}>
                {loading ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.sendBtnText}>Send Love Request</Text>}
              </TouchableOpacity>
            </View>

            {/* Incoming Requests */}
            {pendingRequests.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Incoming Requests</Text>
                {pendingRequests.map(req => (
                  <View key={req.id} style={styles.requestRow}>
                    <Text style={styles.reqName}>@{req.sender.username}</Text>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(req.id)}>
                      <Ionicons name="heart" size={18} color={COLORS.white} />
                      <Text style={styles.acceptText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Sent Requests */}
            {sentRequests.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Sent Requests</Text>
                {sentRequests.map(req => (
                  <View key={req.id} style={styles.requestRow}>
                    <Text style={styles.reqName}>@{req.receiver.username}</Text>
                    <Text style={styles.pendingBadge}>Pending...</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20 },
  headerArea: { alignItems: 'center', marginBottom: 32, marginTop: 20 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  
  card: { backgroundColor: COLORS.card, padding: 20, borderRadius: 16, marginBottom: 16 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  input: { backgroundColor: 'transparent', color: COLORS.textPrimary, padding: 16, borderRadius: 12, marginBottom: 16 },
  sendBtn: { backgroundColor: COLORS.error, padding: 16, borderRadius: 12, alignItems: 'center' },
  sendBtnText: { color: COLORS.white, fontWeight: '800' },
  
  requestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'transparent', padding: 12, borderRadius: 12, marginBottom: 8 },
  reqName: { color: COLORS.textPrimary, fontWeight: '600' },
  acceptBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.error, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
  acceptText: { color: COLORS.white, fontWeight: 'bold' },
  pendingBadge: { color: COLORS.textTertiary, fontSize: 12, fontStyle: 'italic' },
  
  pairedCard: { backgroundColor: COLORS.card, padding: 32, borderRadius: 24, alignItems: 'center', borderWidth: 2, borderColor: COLORS.error },
  pairedText: { color: COLORS.textSecondary, fontSize: 16, marginBottom: 8 },
  partnerName: { color: COLORS.error, fontSize: 28, fontWeight: '900', marginBottom: 32 },
  breakupBtn: { backgroundColor: 'transparent', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: COLORS.divider },
  breakupText: { color: COLORS.textTertiary, fontWeight: '600' }
});
