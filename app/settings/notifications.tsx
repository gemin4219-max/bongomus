import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassView as BlurView } from '@/components/GlassView';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';

import { useTranslation } from 'react-i18next';

export default function NotificationsSettings() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(true);

  return (
    <BlurView intensity={70} tint="dark" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginLeft: -4 }}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('profile.notifications')}</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView style={styles.container}>
        
        <View style={styles.row}>
        <Text style={styles.label}>{t('settings.push_notifs')}</Text>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ false: COLORS.divider, true: COLORS.gold }}
          thumbColor={COLORS.white}
        />
      </View>
        </ScrollView>
      </SafeAreaView>
    </BlurView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, padding: 16, borderRadius: 12 },
  label: { color: COLORS.textPrimary, fontSize: 16 }
});
