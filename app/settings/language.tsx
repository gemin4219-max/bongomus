import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';

export default function LanguageSettings() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const setLanguage = async (lng: string) => {
    await i18n.changeLanguage(lng);
    await AsyncStorage.setItem('bongo_language', lng);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.black }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginLeft: -4 }}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('settings.language')}</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView style={styles.container}>
        <Text style={styles.subtitle}>{t('settings.select_language')}</Text>

      <TouchableOpacity style={styles.row} onPress={() => setLanguage('sw')}>
        <Text style={styles.label}>Kiswahili</Text>
        {i18n.language === 'sw' && <Ionicons name="checkmark" size={24} color={COLORS.gold} />}
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.row} onPress={() => setLanguage('en')}>
        <Text style={styles.label}>English</Text>
        {i18n.language === 'en' && <Ionicons name="checkmark" size={24} color={COLORS.gold} />}
      </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', padding: 16 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, padding: 16, borderRadius: 12, marginBottom: 8 },
  label: { color: COLORS.textPrimary, fontSize: 16 }
});
