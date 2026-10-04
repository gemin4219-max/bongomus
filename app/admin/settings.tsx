// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Alert, 
  ScrollView, 
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getApiCreditBalance } from '../../lib/sunoApi';
import { useThemeStore } from '../../store/themeStore';
import { LinearGradient } from 'expo-linear-gradient';

export default function AdminSettingsScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  
  const [apiCredits, setApiCredits] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [kieKey, setKieKey] = useState('');
  const [aiProvider, setAiProvider] = useState<'suno' | 'kie'>('suno');
  const [savingKey, setSavingKey] = useState(false);
  const [promoteUsername, setPromoteUsername] = useState('');
  const [promoting, setPromoting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mpesaEnabled, setMpesaEnabled] = useState(true);
  const [enablingMpesa, setEnablingMpesa] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [creditsRes, keyRes, kieRes, providerRes] = await Promise.all([
        getApiCreditBalance().catch(() => null),
        supabase.from('system_settings').select('value').eq('key', 'suno_api_key').single(),
        supabase.from('system_settings').select('value').eq('key', 'kie_api_key').single(),
        supabase.from('system_settings').select('value').eq('key', 'ai_api_provider').single(),
      ]);

      if (creditsRes !== null) setApiCredits(creditsRes);
      if (keyRes?.data) setApiKey(keyRes.data.value);
      if (kieRes?.data) setKieKey(kieRes.data.value);
      if (providerRes?.data) setAiProvider(providerRes.data.value as 'suno' | 'kie');

      const { data: mpesaRow } = await supabase.from('system_settings').select('value').eq('key', 'mpesa_enabled').maybeSingle();
      setMpesaEnabled(mpesaRow?.value === 'true');
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async () => {
    setSavingKey(true);
    try {
      const [sunoErr, kieErr, provErr] = await Promise.all([
        supabase.from('system_settings').update({ value: apiKey.trim(), updated_at: new Date().toISOString() }).eq('key', 'suno_api_key'),
        supabase.from('system_settings').update({ value: kieKey.trim(), updated_at: new Date().toISOString() }).eq('key', 'kie_api_key'),
        supabase.from('system_settings').update({ value: aiProvider, updated_at: new Date().toISOString() }).eq('key', 'ai_api_provider')
      ]);
      
      if (sunoErr.error) throw sunoErr.error;
      if (kieErr.error) throw kieErr.error;
      if (provErr.error) throw provErr.error;
      
      Alert.alert('Success', 'API Settings updated successfully! The app will now use the selected provider.');
      
      const credits = await getApiCreditBalance().catch(() => null);
      if (credits !== null) setApiCredits(credits);
    } catch (err: any) {
      Alert.alert('Error updating settings', err.message);
    } finally {
      setSavingKey(false);
    }
  };

  const handleEnableMpesa = () => {
    Alert.alert(
      'Enable Vodacom M-Pesa?',
      'Users will be able to pay with M-Pesa. Only do this once Vodacom is working on the payment provider. This notice will be removed from the admin panel.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'M-Pesa is Working',
          onPress: async () => {
            setEnablingMpesa(true);
            try {
              const { error } = await supabase.from('system_settings').upsert({
                key: 'mpesa_enabled',
                value: 'true',
                updated_at: new Date().toISOString()
              }, { onConflict: 'key' });
              if (error) throw error;
              setMpesaEnabled(true);
              Alert.alert('Done', 'M-Pesa is now accepted on the payment page.');
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setEnablingMpesa(false);
            }
          }
        }
      ]
    );
  };

  const handlePromote = async () => {
    if (!promoteUsername.trim()) return;
    setPromoting(true);
    try {
      const { data, error } = await supabase.rpc('promote_to_admin', { p_username: promoteUsername.trim().toLowerCase() });
      if (error) throw error;
      
      if (data === 'Success') {
        Alert.alert('Success', `@${promoteUsername.trim()} has been promoted to Admin!`);
        setPromoteUsername('');
      } else {
        Alert.alert('Error', data);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setPromoting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={[COLORS.black, COLORS.darkSurface, COLORS.black]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <View style={styles.iconWrapper}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>System Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color={COLORS.gold} size="large" />
            <Text style={styles.loaderText}>Loading system settings...</Text>
          </View>
        ) : (
          <View style={{ gap: 24 }}>
            {/* Top Navigation Cards */}
            <View style={styles.navRow}>
              <TouchableOpacity 
                style={styles.navCard}
                onPress={() => router.push('/admin/events')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[COLORS.cardAlt, COLORS.card]}
                  style={styles.navGradient}
                >
                  <View style={[styles.navIconBox, { backgroundColor: `${COLORS.gold}20` }]}>
                    <Ionicons name="calendar" size={26} color={COLORS.gold} />
                  </View>
                  <Text style={styles.navTitle}>Manage Events</Text>
                  <Text style={styles.navSubtitle}>View & edit upcoming</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.navCard}
                onPress={() => router.push('/admin/event-tickets')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[COLORS.cardAlt, COLORS.card]}
                  style={styles.navGradient}
                >
                  <View style={[styles.navIconBox, { backgroundColor: `${COLORS.goldLight}20` }]}>
                    <Ionicons name="ticket" size={26} color={COLORS.goldLight} />
                  </View>
                  <Text style={styles.navTitle}>Ticket Sales</Text>
                  <Text style={styles.navSubtitle}>Scan RSVPs & tickets</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Vodacom M-Pesa (shown only until admin enables it) */}
            {!mpesaEnabled && (
              <View style={[styles.glassCard, { borderColor: `${COLORS.gold}60` }]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="phone-portrait-outline" size={20} color={COLORS.gold} />
                  <Text style={styles.cardTitle}>Vodacom M-Pesa</Text>
                </View>
                <Text style={[styles.navSubtitle, { fontSize: 14, lineHeight: 20, marginBottom: 16 }]}>
                  M-Pesa is currently blocked. Users see: "Vodacom M-Pesa is not supported right now. Please use Airtel Money, HaloPesa, or Tigo Pesa."
                </Text>
                <TouchableOpacity style={styles.saveBtnWrapper} onPress={handleEnableMpesa} disabled={enablingMpesa}>
                  <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.saveBtn}>
                    {enablingMpesa ? (
                      <ActivityIndicator color={COLORS.black} size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.black} />
                        <Text style={styles.saveBtnText}>M-Pesa is Working - Enable</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* API Settings Section */}
            <View style={styles.glassCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="server-outline" size={20} color={COLORS.textPrimary} />
                <Text style={styles.cardTitle}>API Configuration</Text>
              </View>
              
              <View style={styles.creditsContainer}>
                <Ionicons 
                  name={apiCredits !== null && apiCredits <= 10 ? "warning" : "flash"} 
                  size={24} 
                  color={apiCredits !== null && apiCredits <= 10 ? COLORS.error : COLORS.gold} 
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.sectionLabel}>Remaining Credits ({aiProvider === 'suno' ? 'Suno' : 'KIE'})</Text>
                  <Text style={[styles.statsValue, apiCredits !== null && apiCredits <= 10 && { color: COLORS.error }]}>
                    {apiCredits !== null ? apiCredits.toLocaleString() : '---'} 
                    {apiCredits !== null && apiCredits <= 10 && <Text style={styles.warningText}> (Low)</Text>}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Active AI Provider</Text>
              <View style={styles.providerRow}>
                <TouchableOpacity 
                  style={[styles.providerBtn, aiProvider === 'suno' && { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}15` }]}
                  onPress={() => setAiProvider('suno')}
                >
                  <Ionicons name="musical-notes" size={18} color={aiProvider === 'suno' ? COLORS.gold : COLORS.textTertiary} />
                  <Text style={[styles.providerBtnText, aiProvider === 'suno' && { color: COLORS.gold }]}>Suno API</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.providerBtn, aiProvider === 'kie' && { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}15` }]}
                  onPress={() => setAiProvider('kie')}
                >
                  <Ionicons name="hardware-chip" size={18} color={aiProvider === 'kie' ? COLORS.gold : COLORS.textTertiary} />
                  <Text style={[styles.providerBtnText, aiProvider === 'kie' && { color: COLORS.gold }]}>KIE AI</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionLabel}>Suno API Key</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="key-outline" size={20} color={COLORS.textTertiary} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  value={apiKey} 
                  onChangeText={setApiKey} 
                  placeholder="Enter Suno API Key..." 
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="none"
                  secureTextEntry
                />
              </View>

              <Text style={styles.sectionLabel}>KIE AI API Key</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="key-outline" size={20} color={COLORS.textTertiary} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  value={kieKey} 
                  onChangeText={setKieKey} 
                  placeholder="Enter KIE API Key..." 
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="none"
                  secureTextEntry
                />
              </View>

              <TouchableOpacity style={styles.saveBtnWrapper} onPress={handleSaveKey} disabled={savingKey}>
                <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.saveBtn}>
                  {savingKey ? (
                    <ActivityIndicator color={COLORS.black} size="small" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color={COLORS.black} />
                      <Text style={styles.saveBtnText}>Save Configuration</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Promote Admin Section */}
            <View style={styles.glassCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.textPrimary} />
                <Text style={styles.cardTitle}>Admin Management</Text>
              </View>
              
              <Text style={styles.sectionLabel}>Promote a User to Admin</Text>
              <View style={styles.promoteRow}>
                <View style={[styles.inputWrapper, { flex: 1, marginBottom: 0 }]}>
                  <Ionicons name="person-outline" size={20} color={COLORS.textTertiary} style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    value={promoteUsername} 
                    onChangeText={setPromoteUsername} 
                    placeholder="Username (e.g. dapaz)" 
                    placeholderTextColor={COLORS.textTertiary}
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity 
                  style={styles.promoteBtn} 
                  onPress={handlePromote} 
                  disabled={promoting || !promoteUsername.trim()}
                >
                  {promoting ? (
                    <ActivityIndicator color={COLORS.black} size="small" />
                  ) : (
                    <Ionicons name="arrow-up-circle" size={28} color={promoteUsername.trim() ? COLORS.gold : COLORS.textTertiary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.black 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  backBtn: { 
    width: 44, 
    height: 44, 
    justifyContent: 'center',
    alignItems: 'flex-start'
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.card}80`,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.divider}50`,
  },
  headerTitle: { 
    color: COLORS.textPrimary, 
    fontSize: 20, 
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  content: { 
    padding: 20, 
    paddingBottom: 60,
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  loaderText: {
    color: COLORS.textSecondary,
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  navRow: {
    flexDirection: 'row',
    gap: 16,
  },
  navCard: {
    flex: 1,
    height: 140,
    borderRadius: 20,
    overflow: 'hidden',
  },
  navGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: `${COLORS.divider}60`,
    borderRadius: 20,
  },
  navIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 16,
    left: 16,
  },
  navTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  navSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  glassCard: {
    backgroundColor: `${COLORS.card}80`,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: `${COLORS.divider}40`,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  creditsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.black}40`,
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: `${COLORS.divider}30`,
  },
  sectionLabel: { 
    color: COLORS.textSecondary, 
    fontSize: 13, 
    fontWeight: '600', 
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsValue: { 
    color: COLORS.textPrimary, 
    fontSize: 24, 
    fontWeight: '800',
    marginTop: 2,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
  },
  providerRow: { 
    flexDirection: 'row', 
    gap: 12, 
    marginBottom: 24 
  },
  providerBtn: { 
    flex: 1, 
    flexDirection: 'row',
    padding: 14, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: `${COLORS.divider}80`,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${COLORS.cardAlt}50`,
  },
  providerBtnText: { 
    color: COLORS.textSecondary, 
    fontWeight: '600', 
    fontSize: 15 
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.black}60`,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLORS.divider}60`,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: { 
    flex: 1, 
    color: COLORS.textPrimary, 
    paddingVertical: 16, 
    fontSize: 15,
    fontWeight: '500',
  },
  saveBtnWrapper: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveBtn: { 
    flexDirection: 'row',
    padding: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 8,
  },
  saveBtnText: { 
    color: COLORS.black, 
    fontWeight: '800', 
    fontSize: 16,
    letterSpacing: 0.5,
  },
  promoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  promoteBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: `${COLORS.card}90`,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.divider}60`,
  },
});
