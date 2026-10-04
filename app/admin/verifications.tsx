// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

import { supabase } from '../../lib/supabase';
import { Image } from 'expo-image';

type Request = {
  id: string;
  user_id: string;
  social_links: string;
  status: string;
  created_at: string;
  profile: {
    display_name: string;
    username: string;
    avatar_url: string;
  };
};

export default function AdminVerificationsScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const profile = useAuthStore(s => s.profile);
  const router = useRouter();
  
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role !== 'admin') {
      Alert.alert('Unauthorized', 'You do not have permission to view this page.');
      router.back();
      return;
    }
    fetchRequests();
  }, [profile]);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('verification_requests')
      .select('*, profile:profiles(display_name, username, avatar_url)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to fetch verification requests');
    } else {
      setRequests(data as any);
    }
    setLoading(false);
  };

  const handleAction = async (requestId: string, newStatus: 'approved' | 'rejected') => {
    Alert.alert(
      `Confirm ${newStatus === 'approved' ? 'Approval' : 'Rejection'}`,
      `Are you sure you want to ${newStatus === 'approved' ? 'approve' : 'reject'} this request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: newStatus === 'approved' ? 'Approve' : 'Reject', 
          style: newStatus === 'approved' ? 'default' : 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('verification_requests')
              .update({ status: newStatus })
              .eq('id', requestId);

            if (error) {
              Alert.alert('Error', error.message);
            } else {
              // Automatically update their profile if approved
              if (newStatus === 'approved') {
                const req = requests.find(r => r.id === requestId);
                if (req) {
                  await supabase.from('profiles').update({ is_verified: true }).eq('id', req.user_id);
                }
              }
              setRequests(prev => prev.filter(req => req.id !== requestId));
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Admin: Verifications', headerShown: true, headerStyle: { backgroundColor: COLORS.black }, headerTintColor: COLORS.gold, headerBackTitleVisible: false, headerBackTitle: ' ' }} />
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
      <Stack.Screen options={{ title: 'Admin: Verifications', headerShown: true, headerStyle: { backgroundColor: COLORS.black }, headerTintColor: COLORS.gold, headerBackTitleVisible: false, headerBackTitle: ' ' }} />
      
      <Text style={styles.title}>Pending Verifications</Text>
      
      {requests.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle-outline" size={60} color={COLORS.textTertiary} />
          <Text style={styles.emptyText}>No pending requests.</Text>
          <Text style={styles.emptySub}>You're all caught up!</Text>
        </View>
      ) : (
        requests.map((req) => (
          <View key={req.id} style={styles.card}>
            <View style={styles.cardHeader}>
              {req.profile.avatar_url ? (
                <Image source={{ uri: req.profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: COLORS.cardAlt, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="person" size={24} color={COLORS.textTertiary} />
                </View>
              )}
              <View style={styles.userInfo}>
                <Text style={styles.name}>{req.profile.display_name}</Text>
                <Text style={styles.username}>@{req.profile.username}</Text>
              </View>
            </View>

            <View style={styles.linksBox}>
              <Text style={styles.linksLabel}>Social Links & Details:</Text>
              <Text style={styles.linksText}>{req.social_links}</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={() => handleAction(req.id, 'rejected')}>
                <Ionicons name="close" size={20} color={COLORS.error} />
                <Text style={[styles.btnText, { color: COLORS.error }]}>Reject</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.btn, styles.approveBtn]} onPress={() => handleAction(req.id, 'approved')}>
                <Ionicons name="checkmark" size={20} color={COLORS.black} />
                <Text style={[styles.btnText, { color: COLORS.black }]}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  center: { flex: 1, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: COLORS.black },
  title: { color: COLORS.textPrimary, fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 8 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.divider },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  userInfo: { flex: 1 },
  name: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold' },
  username: { color: COLORS.textSecondary, fontSize: 14 },
  linksBox: { backgroundColor: COLORS.black, padding: 12, borderRadius: 8, marginBottom: 16 },
  linksLabel: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 },
  linksText: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  rejectBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.error },
  approveBtn: { backgroundColor: COLORS.gold },
  btnText: { fontWeight: 'bold', fontSize: 15 }
});
