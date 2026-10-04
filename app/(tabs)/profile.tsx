import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useLayoutStore } from '../../store/layoutStore';

import { useTranslation } from 'react-i18next';
import * as ScreenCapture from 'expo-screen-capture';
import * as Haptics from 'expo-haptics';

export default function ProfileScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const profile = useAuthStore(s => s.profile);
  const signOut = useAuthStore(s => s.signOut);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  
  useFocusEffect(
    React.useCallback(() => {
      useLayoutStore.getState().setIsNavVisible(true);
    }, [])
  );

  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [isWarningDismissed, setIsWarningDismissed] = useState(false);

  const handleOpenImage = async () => {
    setIsImageModalVisible(true);
  };

  const handleCloseImage = async () => {
    setIsImageModalVisible(false);
  };

  if (!session || !profile) {
    return (
      <View style={styles.noAuth}>
        <Ionicons name="person-circle" size={80} color={COLORS.textSecondary} />
        <Text style={styles.noAuthTitle}>{t('profile.my_account')}</Text>
        <Text style={styles.noAuthText}>{t('profile.login_prompt')}</Text>
        <TouchableOpacity 
          style={styles.loginBtn} 
          onPress={() => {
            useAuthStore.getState().disableOfflineMode();
            router.push('/auth');
          }}
        >
          <Text style={styles.loginBtnText}>{t('profile.login_btn')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isAnonymous = session?.user?.is_anonymous;

  const handleSignOut = () => {
    Alert.alert(t('profile.sign_out'), t('profile.confirm_sign_out'), [
      { text: t('profile.no'), style: 'cancel' },
      { text: t('profile.yes_sign_out'), style: 'destructive', onPress: () => { signOut(); } },
    ]);
  };

  const displayUsername = isAnonymous 
    ? `@bongo_guest_${profile?.id?.substring(0, 4)}` 
    : `@${profile?.username}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
      {/* Profile header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.avatarContainer} 
          onPress={handleOpenImage} 
          disabled={!profile.avatar_url}
          activeOpacity={0.8}
        >
          {profile.avatar_url ? (
            <Image 
              source={{ uri: profile.avatar_url }} 
              style={{ width: '100%', height: '100%', borderRadius: 45 }} 
              transition={200}
            />
          ) : (
            <Ionicons name="musical-notes" size={40} color={COLORS.gold} />
          )}
        </TouchableOpacity>
        <Text style={styles.displayName}>{profile.display_name}</Text>
        <Text style={styles.username}>{displayUsername}</Text>
        {profile.is_verified && !isAnonymous && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.gold} />
            <Text style={styles.verified}>{t('profile.verified')}</Text>
          </View>
        )}
        
        {isAnonymous && !isWarningDismissed && (
          <View style={{ backgroundColor: 'rgba(255, 60, 60, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 60, 60, 0.3)', borderRadius: 16, padding: 16, marginTop: 16, alignItems: 'center' }}>
            <TouchableOpacity 
              style={{ position: 'absolute', top: 12, right: 12 }} 
              onPress={() => setIsWarningDismissed(true)}
            >
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <Ionicons name="warning" size={24} color={COLORS.error || '#ff4444'} style={{ marginBottom: 8 }} />
            <Text style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>Don't lose your music & credits!</Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
              You are using a temporary Guest account. If you delete the app or change phones, you will lose your credits, playlists, and history permanently.
            </Text>
            <TouchableOpacity 
              style={{ backgroundColor: COLORS.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, width: '100%', alignItems: 'center' }}
              onPress={() => router.push('/auth')}
            >
              <Text style={{ color: COLORS.black, fontWeight: '800', fontSize: 14 }}>Claim Your Account Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {isAnonymous && isWarningDismissed && (
          <TouchableOpacity 
            style={{ backgroundColor: COLORS.gold, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 12 }}
            onPress={() => router.push('/auth')}
          >
            <Text style={{ color: COLORS.black, fontWeight: '800', fontSize: 14 }}>Claim your account</Text>
          </TouchableOpacity>
        )}

        <View style={styles.statsRow}>
          <StatItem label={t('profile.followers')} value={profile.follower_count || 0} styles={styles} />
          <View style={styles.statDivider} />
          <StatItem label={t('profile.following')} value={profile.following_count || 0} styles={styles} />
          <View style={styles.statDivider} />
          <StatItem label={t('profile.plays')} value={profile.total_plays || 0} styles={styles} />
        </View>

        <View style={[styles.statsRow, { marginTop: 12 }]}>
          <StatItem label={t('profile.songs')} value={profile.track_count || 0} styles={styles} />
          <View style={styles.statDivider} />
          <StatItem label="Credits" value={profile.credits || 0} styles={styles} />
        </View>
      </View>

      {/* Role badge */}
      <View style={[styles.roleBadge, { borderColor: (profile.role === 'artist' || profile.role === 'admin') ? COLORS.gold : COLORS.textTertiary }]}>
        <Ionicons name={profile.role === 'admin' ? 'shield-checkmark' : profile.role === 'artist' ? 'mic' : 'headset'} size={16} color={(profile.role === 'artist' || profile.role === 'admin') ? COLORS.gold : COLORS.textSecondary} />
        <Text style={[styles.roleText, { color: (profile.role === 'artist' || profile.role === 'admin') ? COLORS.gold : COLORS.textSecondary }]}>
          {profile.role === 'admin' ? 'Admin' : profile.role === 'artist' ? t('profile.artist') : t('profile.listener')}
        </Text>
      </View>

      {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      {profile.location && (
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color={COLORS.textTertiary} />
          <Text style={styles.location}>{profile.location}</Text>
        </View>
      )}

      {/* Primary Actions Group */}
      <View style={styles.settingsGroup}>
        {profile.role === 'admin' && (
          <>
            <MenuRow icon="stats-chart" label="Admin Dashboard: Revenue & Users" iconColor={COLORS.error} onPress={() => router.push('/admin/dashboard')} styles={styles} COLORS={COLORS} />
            <MenuRow icon="settings" label="Admin System Settings" iconColor={COLORS.error} onPress={() => router.push('/admin/settings')} styles={styles} COLORS={COLORS} />
            <MenuRow icon="images" label="Admin Panel: Get Inspired Cards" iconColor={COLORS.error} onPress={() => router.push('/admin/carousel')} styles={styles} COLORS={COLORS} />
            <MenuRow icon="calendar" label="Admin Panel: Manage Events" iconColor={COLORS.error} onPress={() => router.push('/admin/events')} styles={styles} COLORS={COLORS} />
            <MenuRow icon="shield-checkmark" label="Admin Panel: Manage Tickets" iconColor={COLORS.error} onPress={() => router.push('/admin/tickets')} styles={styles} COLORS={COLORS} />
            <MenuRow icon="checkmark-done-circle" label="Admin Panel: Verifications" iconColor={COLORS.error} onPress={() => router.push('/admin/verifications')} styles={styles} COLORS={COLORS} />
            <MenuRow icon="warning" label="Admin Panel: DMCA Reports" iconColor={COLORS.error} onPress={() => router.push('/admin/reports')} styles={styles} COLORS={COLORS} />
            <MenuRow icon="list" label="Admin Panel: Manage Genres" iconColor={COLORS.error} onPress={() => router.push('/admin/genres')} styles={styles} COLORS={COLORS} />
          </>
        )}
        {(profile.role === 'artist' || profile.role === 'admin') && (
          <>
            <MenuRow icon="stats-chart" label="Artist Analytics Dashboard" iconColor={COLORS.gold} onPress={() => router.push('/artist/dashboard')} styles={styles} COLORS={COLORS} />
            <MenuRow icon="wallet" label="Wallet & Payouts" iconColor={COLORS.gold} onPress={() => router.push('/artist/wallet')} styles={styles} COLORS={COLORS} />
            <MenuRow icon="checkmark-circle" label="Get Verified" iconColor={COLORS.gold} onPress={() => router.push('/settings/verify')} styles={styles} COLORS={COLORS} />
          </>
        )}
        {profile.role !== 'artist' && profile.role !== 'admin' && !isAnonymous && (
          <MenuRow icon="star" label="Become an Artist" iconColor={COLORS.gold} onPress={() => router.push('/settings/become-artist')} styles={styles} COLORS={COLORS} />
        )}
        <MenuRow icon="bar-chart" label="Bongo Wrapped (Stats)" iconColor={COLORS.gold} onPress={() => router.push('/stats')} styles={styles} COLORS={COLORS} />
        <MenuRow icon="diamond" label="Buy Credits" iconColor={COLORS.gold} onPress={() => router.push('/buy-credits')} styles={styles} COLORS={COLORS} />
        <MenuRow icon="radio" label="Live Radio 📻" iconColor="#FF3B6A" onPress={() => router.push('/(tabs)/radio')} styles={styles} COLORS={COLORS} />
        <MenuRow icon="library" label="Workspace 🎛️" iconColor="#00C6FF" onPress={() => router.push('/(tabs)/library')} styles={styles} COLORS={COLORS} />
        <MenuRow icon="library-outline" label={t('tabs.library') || "My Library"} iconColor={COLORS.textPrimary} onPress={() => router.push('/library')} styles={styles} COLORS={COLORS} />
        <MenuRow icon="person-outline" label={t('profile.edit_profile')} iconColor={COLORS.textPrimary} onPress={() => router.push('/settings/edit-profile')} isLast styles={styles} COLORS={COLORS} />
      </View>

      {/* Settings section */}
      <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
      <View style={styles.settingsGroup}>
        <MenuRow icon="ticket" label="My Event Tickets 🎟️" iconColor={COLORS.gold} onPress={() => router.push('/my-tickets')} styles={styles} COLORS={COLORS} />
        <MenuRow icon="color-palette-outline" label="App Theme" iconColor={COLORS.gold} onPress={() => router.push('/settings/theme')} styles={styles} COLORS={COLORS} />
        <MenuRow icon="heart" label="Pair with Partner" iconColor={COLORS.error} onPress={() => router.push('/settings/pair-partner')} styles={styles} COLORS={COLORS} />
        <MenuRow icon="notifications-outline" label={t('profile.notifications')} iconColor={COLORS.textSecondary} onPress={() => router.push('/settings/notifications')} styles={styles} COLORS={COLORS} />
        <MenuRow icon="language-outline" label={t('settings.language')} iconColor={COLORS.textSecondary} onPress={() => router.push('/settings/language')} styles={styles} COLORS={COLORS} />
        <MenuRow icon="headset-outline" label="Help & Support" iconColor={COLORS.textSecondary} onPress={() => router.push('/settings/support')} styles={styles} COLORS={COLORS} />
        <MenuRow icon="information-circle-outline" label={t('profile.about')} iconColor={COLORS.textSecondary} onPress={() => router.push('/settings/about')} isLast styles={styles} COLORS={COLORS} />
      </View>

      {!isAnonymous && (
        <View style={[styles.settingsGroup, { marginBottom: 40, borderColor: 'rgba(255, 59, 48, 0.3)' }]}>
          <MenuRow icon="log-out-outline" label={t('profile.sign_out')} iconColor={COLORS.error} onPress={handleSignOut} isLast styles={styles} COLORS={COLORS} />
        </View>
      )}

      {/* Full Screen Image Modal */}
      <Modal visible={isImageModalVisible} transparent={true} animationType="fade" onRequestClose={handleCloseImage}>
        <View style={styles.modalBackground}>
          <TouchableOpacity style={[styles.closeModalBtn, { top: Math.max(50, insets.top + 10) }]} onPress={handleCloseImage}>
            <Ionicons name="close" size={32} color={COLORS.textPrimary} />
          </TouchableOpacity>
          {profile.avatar_url && (
            <Image 
              source={{ uri: profile.avatar_url }} 
              style={styles.fullScreenImage} 
              contentFit="contain"
            />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

function StatItem({ label, value, styles }: { label: string; value: number; styles: any }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({ icon, label, onPress, iconColor, isLast, styles, COLORS }: { icon: string; label: string; onPress: () => void, iconColor: string, isLast?: boolean, styles: any, COLORS: any }) {
  return (
    <TouchableOpacity style={[styles.menuRow, isLast && styles.menuRowLast]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); onPress(); }}>
      <View style={styles.menuIconBox}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
    </TouchableOpacity>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black, paddingTop: 60 },
  header: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  avatarContainer: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 3, borderColor: COLORS.gold },
  displayName: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
  username: { color: COLORS.textSecondary, fontSize: 14, marginTop: 2 },
  verified: { color: COLORS.gold, fontSize: 12, fontWeight: '700', marginTop: 4 },
  statsRow: { flexDirection: 'row', marginTop: 20, backgroundColor: COLORS.card, borderRadius: 16, padding: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  statLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.divider },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 12 },
  roleText: { fontSize: 13, fontWeight: '600' },
  bio: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginHorizontal: 24, marginTop: 12, lineHeight: 20 },
  locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  location: { color: COLORS.textTertiary, fontSize: 13 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginHorizontal: 24, marginTop: 32, marginBottom: 8 },
  settingsGroup: { marginTop: 12, paddingBottom: 8 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, gap: 16 },
  menuRowLast: {},
  menuIconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.cardAlt, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  signOutText: { color: COLORS.error, fontSize: 16, fontWeight: '700' },
  noAuth: { flex: 1, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center', gap: 12 },
  noAuthTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  noAuthText: { color: COLORS.textSecondary, fontSize: 14 },
  loginBtn: { backgroundColor: COLORS.gold, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  loginBtnText: { color: COLORS.black, fontWeight: '800', fontSize: 16 },
  
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeModalBtn: { position: 'absolute', right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  fullScreenImage: { flex: 1, width: '100%', height: '100%' },
});
