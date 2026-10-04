// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';

export default function ArtistWalletScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Artist Wallet', 
        headerShown: true, 
        headerStyle: { backgroundColor: COLORS.black }, 
        headerTintColor: COLORS.gold, 
        headerBackTitleVisible: false 
      }} />
      
      <Ionicons name="wallet-outline" size={80} color={COLORS.textTertiary} style={{ marginBottom: 20 }} />
      <Text style={styles.title}>Wallet & Payouts</Text>
      <Text style={styles.subtitle}>Coming Soon</Text>
      
      <Text style={styles.description}>
        We are building a robust payment dashboard where you can track your earnings from Ads, Tips, and Song Battles, and withdraw them directly to your Mobile Money account.
      </Text>

      <View style={styles.badge}>
        <Ionicons name="construct-outline" size={16} color={COLORS.gold} />
        <Text style={styles.badgeText}>Under Construction</Text>
      </View>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.black, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 24
  },
  title: { 
    color: COLORS.textPrimary, 
    fontSize: 28, 
    fontWeight: '900', 
    marginBottom: 8 
  },
  subtitle: { 
    color: COLORS.gold, 
    fontSize: 20, 
    fontWeight: '700',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 2
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)'
  },
  badgeText: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '600'
  }
});
