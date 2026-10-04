// @ts-nocheck
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

export default function AdminEventTicketsScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      checkAdminAndLoad();
    }, [])
  );

  const checkAdminAndLoad = async () => {
    if (!session) {
      router.replace('/');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile?.role !== 'admin') {
      router.replace('/');
      return;
    }
    loadTickets();
  };

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('event_tickets')
        .select(`
          *,
          profile:profiles!event_tickets_user_id_fkey(display_name),
          event:events(title)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data as any);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTickets();
  };

  const markUsed = async (ticketId: string) => {
    Alert.alert('Scan Ticket', 'Mark this ticket as USED?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Mark Used', 
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('event_tickets').update({ status: 'used' }).eq('id', ticketId);
          if (error) Alert.alert('Error', error.message);
          else loadTickets();
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Ticket Sales</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={t => t.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="ticket-outline" size={64} color={COLORS.textTertiary} />
              <Text style={{ color: COLORS.textSecondary, marginTop: 12 }}>No tickets sold yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.ticketCard, item.status === 'used' && { opacity: 0.6 }]}>
              <View style={styles.ticketHeader}>
                <View>
                  <Text style={styles.userName}>{item.profile?.display_name || 'Unknown User'}</Text>
                  <Text style={styles.eventName}>{item.event?.title}</Text>
                </View>
                <View style={[styles.badge, item.status === 'used' ? styles.badgeUsed : styles.badgeActive]}>
                  <Text style={[styles.badgeText, item.status === 'used' ? styles.textUsed : styles.textActive]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <View style={styles.codeRow}>
                <Ionicons name="qr-code" size={24} color={COLORS.textSecondary} />
                <Text style={styles.codeText}>{item.ticket_code}</Text>
              </View>

              {item.status === 'active' && (
                <TouchableOpacity style={styles.scanBtn} onPress={() => markUsed(item.id)}>
                  <Ionicons name="scan" size={18} color={COLORS.black} />
                  <Text style={styles.scanBtnText}>Mark as Used (Scan)</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 16, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  
  list: { padding: 16, gap: 12, paddingBottom: 60 },
  empty: { alignItems: 'center', marginTop: 80 },
  
  ticketCard: { backgroundColor: COLORS.cardAlt, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.divider },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  userName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  eventName: { color: COLORS.gold, fontSize: 13, fontWeight: '600' },
  
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeActive: { backgroundColor: 'rgba(74, 222, 128, 0.15)' },
  badgeUsed: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  textActive: { color: '#4ade80', fontSize: 10, fontWeight: '800' },
  textUsed: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '800' },
  
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 },
  codeText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  
  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.gold, padding: 12, borderRadius: 8, marginTop: 16 },
  scanBtnText: { color: COLORS.black, fontWeight: '800', fontSize: 14 },
});
