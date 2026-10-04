// @ts-nocheck
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, RefreshControl, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';


type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  admin_reply?: string;
  status: string;
  created_at: string;
  profile: {
    display_name: string;
    email: string;
  };
};

export default function AdminTicketsScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'open' | 'closed'>('open');
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});

  useFocusEffect(
    useCallback(() => {
      loadTickets();
    }, [filter])
  );

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          profile:profiles!support_tickets_user_id_fkey(display_name)
        `)
        .eq('status', filter)
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

  const handleReplyAndResolve = async (ticketId: string) => {
    const text = replyText[ticketId] || '';
    
    Alert.alert(
      text ? 'Send Reply & Resolve' : 'Resolve Ticket',
      text ? 'Are you sure you want to send this reply and close the ticket?' : 'Mark this ticket as closed without a reply?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: text ? 'Send & Close' : 'Close Ticket',
          style: 'default',
          onPress: async () => {
            const updates: any = { status: 'closed' };
            if (text.trim()) updates.admin_reply = text.trim();
            
            const { error } = await supabase
              .from('support_tickets')
              .update(updates)
              .eq('id', ticketId);

            if (error) {
              Alert.alert('Error', error.message);
            } else {
              setTickets(tickets.filter(t => t.id !== ticketId));
              setReplyText(prev => { const next = {...prev}; delete next[ticketId]; return next; });
              Alert.alert('Success', 'Ticket updated successfully.');
            }
          }
        }
      ]
    );
  };

  if (!session) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Tickets</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, filter === 'open' && styles.tabActive]} 
          onPress={() => setFilter('open')}
        >
          <Text style={[styles.tabText, filter === 'open' && styles.tabTextActive]}>Open Tickets</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, filter === 'closed' && styles.tabActive]} 
          onPress={() => setFilter('closed')}
        >
          <Text style={[styles.tabText, filter === 'closed' && styles.tabTextActive]}>Resolved</Text>
        </TouchableOpacity>
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
              <Ionicons name="checkmark-done-circle-outline" size={64} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>No {filter} tickets found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <View>
                  <Text style={styles.userName}>{item.profile?.display_name || 'Unknown User'}</Text>
                  <Text style={styles.date}>
                    {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(item.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={[styles.badge, item.status === 'open' ? styles.badgeOpen : styles.badgeClosed]}>
                  <Text style={[styles.badgeText, item.status === 'open' ? styles.badgeTextOpen : styles.badgeTextClosed]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.subject}>{item.subject}</Text>
              <Text style={styles.message}>{item.message}</Text>

              {item.admin_reply && (
                <View style={styles.adminReplyBox}>
                  <Text style={styles.adminReplyTitle}>Your Reply:</Text>
                  <Text style={styles.adminReplyText}>{item.admin_reply}</Text>
                </View>
              )}

              {item.status === 'open' && (
                <View style={styles.replyContainer}>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Type a reply to the user... (Optional)"
                    placeholderTextColor={COLORS.textTertiary}
                    value={replyText[item.id] || ''}
                    onChangeText={text => setReplyText(prev => ({ ...prev, [item.id]: text }))}
                    multiline
                  />
                  <TouchableOpacity style={styles.resolveBtn} onPress={() => handleReplyAndResolve(item.id)}>
                    <Ionicons name={replyText[item.id] ? "send" : "checkmark-circle"} size={18} color={COLORS.black} />
                    <Text style={styles.resolveBtnText}>{replyText[item.id] ? "Send Reply & Resolve" : "Mark as Resolved"}</Text>
                  </TouchableOpacity>
                </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  tabs: { flexDirection: 'row', padding: 16, gap: 12 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.divider },
  tabActive: { backgroundColor: COLORS.gold + '20', borderColor: COLORS.gold },
  tabText: { color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: COLORS.gold },
  list: { padding: 16, gap: 16, paddingBottom: 60 },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16 },
  ticketCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.divider },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  userName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  date: { color: COLORS.textTertiary, fontSize: 12, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeOpen: { backgroundColor: 'rgba(255, 60, 60, 0.1)' },
  badgeClosed: { backgroundColor: 'rgba(60, 255, 60, 0.1)' },
  badgeText: { fontSize: 10, fontWeight: '800' },
  badgeTextOpen: { color: COLORS.error },
  badgeTextClosed: { color: '#4ade80' },
  subject: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  message: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22 },
  replyContainer: { marginTop: 16 },
  replyInput: { backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: COLORS.divider, borderRadius: 12, padding: 12, color: COLORS.textPrimary, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 12 },
  resolveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.gold, padding: 12, borderRadius: 8 },
  resolveBtnText: { color: COLORS.black, fontWeight: '700', fontSize: 14 },
  adminReplyBox: { marginTop: 12, padding: 12, backgroundColor: 'rgba(255, 215, 0, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.3)' },
  adminReplyTitle: { color: COLORS.gold, fontSize: 12, fontWeight: '800', marginBottom: 4, textTransform: 'uppercase' },
  adminReplyText: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 22 },
});
