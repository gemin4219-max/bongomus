// @ts-nocheck
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

export default function MyTicketsScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) {
        router.replace('/');
        return;
      }
      loadTickets();
    }, [session])
  );

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('event_tickets')
        .select(`
          *,
          event:events(title, location, event_date, image_url)
        `)
        .eq('user_id', session?.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data as any);
    } catch (err: any) {
      console.error(err);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Event Tickets</Text>
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
              <Text style={styles.emptyTitle}>No tickets found</Text>
              <Text style={styles.emptyText}>You haven't bought any tickets yet.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUsed = item.status === 'used';
            const eventDate = new Date(item.event.event_date);
            return (
              <View style={[styles.ticketCard, isUsed && { opacity: 0.6 }]}>
                {/* Top Section */}
                <View style={styles.ticketTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{item.event.title}</Text>
                    <Text style={styles.eventLocation}>
                      <Ionicons name="location" size={12} /> {item.event.location}
                    </Text>
                    <Text style={styles.eventDate}>
                      <Ionicons name="calendar" size={12} /> {eventDate.toLocaleDateString()} at {eventDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </Text>
                  </View>
                  <View style={styles.qrPlaceholder}>
                    <Ionicons name="qr-code" size={48} color={COLORS.textPrimary} />
                  </View>
                </View>

                {/* Perforated Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.notchLeft} />
                  <View style={styles.dashedLine} />
                  <View style={styles.notchRight} />
                </View>

                {/* Bottom Section */}
                <View style={styles.ticketBottom}>
                  <View>
                    <Text style={styles.label}>TICKET CODE</Text>
                    <Text style={styles.codeText}>{item.ticket_code}</Text>
                  </View>
                  <View style={[styles.statusBadge, isUsed ? styles.badgeUsed : styles.badgeActive]}>
                    <Text style={[styles.statusText, isUsed ? styles.textUsed : styles.textActive]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
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
  
  list: { padding: 16, gap: 16, paddingBottom: 60 },
  empty: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
  
  ticketCard: { backgroundColor: COLORS.cardAlt, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.divider },
  ticketTop: { flexDirection: 'row', padding: 20, justifyContent: 'space-between', alignItems: 'center' },
  eventTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 8 },
  eventLocation: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 4 },
  eventDate: { color: COLORS.textSecondary, fontSize: 13 },
  
  qrPlaceholder: { backgroundColor: '#fff', padding: 8, borderRadius: 8 },
  
  dividerRow: { flexDirection: 'row', alignItems: 'center', height: 20 },
  notchLeft: { width: 10, height: 20, borderTopRightRadius: 10, borderBottomRightRadius: 10, backgroundColor: COLORS.black, marginLeft: -1 },
  notchRight: { width: 10, height: 20, borderTopLeftRadius: 10, borderBottomLeftRadius: 10, backgroundColor: COLORS.black, marginRight: -1 },
  dashedLine: { flex: 1, height: 1, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.divider, marginHorizontal: 10 },
  
  ticketBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: 'rgba(255,255,255,0.02)' },
  label: { color: COLORS.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  codeText: { color: COLORS.gold, fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  badgeActive: { backgroundColor: 'rgba(74, 222, 128, 0.15)' },
  badgeUsed: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  textActive: { color: '#4ade80', fontSize: 12, fontWeight: '800' },
  textUsed: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800' },
});
