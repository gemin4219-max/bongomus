// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQS = [
  {
    question: "How do I claim an artist account?",
    answer: "To claim an artist account, go to your profile, ensure you have uploaded a profile picture, and then tap on 'Become an Artist'. If you're a guest, you must first claim your account by signing in."
  },
  {
    question: "How do I pair with a partner?",
    answer: "Go to Settings > Pair with Partner, and ask your partner for their 6-digit pairing code. Enter the code to link your accounts and share playlists."
  },
  {
    question: "Why can't I see my lyrics?",
    answer: "Lyrics are provided for verified tracks. If a track does not have lyrics, it means the artist has not uploaded them yet."
  },
  {
    question: "How do I pay for AI generation?",
    answer: "We don't use subscriptions! You simply buy in-app credits and pay per generation. Your credits stay in your account until you use them."
  }
];

export default function SupportFAQScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === index ? null : index);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Help & Support</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.iconContainer}>
            <Ionicons name="help-buoy" size={60} color={COLORS.gold} />
            <Text style={styles.title}>How can we help?</Text>
            <Text style={styles.subtitle}>
              Find answers to frequently asked questions below, or open a ticket if you need more help.
            </Text>
          </View>

          <TouchableOpacity style={styles.openTicketBtn} onPress={() => router.push('/settings/tickets')}>
            <Ionicons name="chatbubbles" size={20} color={COLORS.black} />
            <Text style={styles.openTicketBtnText}>Open a Support Ticket</Text>
          </TouchableOpacity>

          <View style={styles.faqSection}>
            <Text style={styles.faqHeader}>Frequently Asked Questions</Text>
            {FAQS.map((faq, index) => {
              const isExpanded = expandedId === index;
              return (
                <TouchableOpacity 
                  key={index} 
                  style={styles.faqCard} 
                  activeOpacity={0.8}
                  onPress={() => toggleExpand(index)}
                >
                  <View style={styles.faqQuestionRow}>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Ionicons 
                      name={isExpanded ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color={COLORS.gold} 
                    />
                  </View>
                  {isExpanded && (
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 60 },
  iconContainer: { alignItems: 'center', marginBottom: 24, marginTop: 10 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginTop: 16 },
  subtitle: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  openTicketBtn: { 
    backgroundColor: COLORS.gold, 
    flexDirection: 'row',
    borderRadius: 16, 
    padding: 18, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 32,
    gap: 8
  },
  openTicketBtnText: { color: COLORS.black, fontSize: 16, fontWeight: '800' },
  faqSection: { marginTop: 8 },
  faqHeader: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 0.5 },
  faqCard: { 
    backgroundColor: COLORS.card, 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.divider
  },
  faqQuestionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', flex: 1, paddingRight: 16 },
  faqAnswer: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.divider },
});
