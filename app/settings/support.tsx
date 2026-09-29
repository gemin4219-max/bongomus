import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassView as BlurView } from '@/components/GlassView';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';


export default function SupportScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const [activeTab, setActiveTab] = useState<'submit' | 'tickets'>('submit');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  React.useEffect(() => {
    if (activeTab === 'tickets') {
      loadMyTickets();
    }
  }, [activeTab]);

  const loadMyTickets = async () => {
    if (!session?.user) return;
    setLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleSubmit = async () => {
    if (!session?.user) {
      Alert.alert('Error', 'You must be logged in to submit a ticket.');
      return;
    }

    if (!subject.trim() || !message.trim()) {
      Alert.alert('Missing Fields', 'Please enter both a subject and a message.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: session.user.id,
          subject: subject.trim(),
          message: message.trim(),
        });

      if (error) throw error;

      Alert.alert(
        'Ticket Submitted', 
        'Your message has been sent to our support team. We will get back to you shortly.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: any) {
      console.error('Submit ticket error:', err);
      Alert.alert('Submission Failed', err.message || 'An error occurred while submitting your ticket.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BlurView intensity={70} tint="dark" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView 
          style={styles.container} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Help & Support</Text>
            <View style={{ width: 40 }} />
          </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'submit' && styles.tabActive]} onPress={() => setActiveTab('submit')}>
          <Text style={[styles.tabText, activeTab === 'submit' && styles.tabTextActive]}>Contact Us</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'tickets' && styles.tabActive]} onPress={() => setActiveTab('tickets')}>
          <Text style={[styles.tabText, activeTab === 'tickets' && styles.tabTextActive]}>My Tickets</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'submit' ? (
        <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="headset" size={60} color={COLORS.gold} />
          <Text style={styles.title}>How can we help?</Text>
          <Text style={styles.subtitle}>
            Report a bug, complain about a payment issue, or ask a question.
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Payment Failed, Bug Report..."
            placeholderTextColor={COLORS.textTertiary}
            value={subject}
            onChangeText={setSubject}
            maxLength={100}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Please describe your issue in detail..."
            placeholderTextColor={COLORS.textTertiary}
            value={message}
            onChangeText={setMessage}
            multiline
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitBtnText}>
            {loading ? 'Submitting...' : 'Submit Ticket'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      ) : (
        <View style={styles.ticketsContent}>
          {loadingTickets ? (
            <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
          ) : tickets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={60} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>You haven't opened any support tickets yet.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              {tickets.map(ticket => (
                <View key={ticket.id} style={styles.ticketCard}>
                  <View style={styles.ticketHeader}>
                    <Text style={styles.ticketDate}>
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </Text>
                    <View style={[styles.badge, ticket.status === 'open' ? styles.badgeOpen : styles.badgeClosed]}>
                      <Text style={[styles.badgeText, ticket.status === 'open' ? styles.badgeTextOpen : styles.badgeTextClosed]}>
                        {ticket.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                  <Text style={styles.ticketMessage}>{ticket.message}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </BlurView>
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
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 16,
    padding: 16,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  textArea: {
    height: 150,
    paddingTop: 16,
  },
  submitBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '800',
  },
  tabs: { flexDirection: 'row', padding: 16, gap: 12 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.divider },
  tabActive: { backgroundColor: COLORS.gold + '20', borderColor: COLORS.gold },
  tabText: { color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: COLORS.gold },
  ticketsContent: { flex: 1 },
  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16 },
  ticketCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.divider },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  ticketDate: { color: COLORS.textTertiary, fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeOpen: { backgroundColor: 'rgba(255, 60, 60, 0.1)' },
  badgeClosed: { backgroundColor: 'rgba(60, 255, 60, 0.1)' },
  badgeText: { fontSize: 10, fontWeight: '800' },
  badgeTextOpen: { color: COLORS.error },
  badgeTextClosed: { color: '#4ade80' },
  ticketSubject: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  ticketMessage: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22 },
});
