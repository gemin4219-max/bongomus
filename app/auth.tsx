// @ts-nocheck
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

export default function AuthScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const signIn = useAuthStore(s => s.signIn);
  const signUp = useAuthStore(s => s.signUp);
  const isLoading = useAuthStore(s => s.isLoading);
  const enableOfflineMode = useAuthStore(s => s.enableOfflineMode);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isArtist, setIsArtist] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);
  const [vpwVisible, setVpwVisible] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) { Alert.alert('Kosa', 'Jaza barua pepe na nywila'); return; }
    
    if (mode === 'signup') {
      if (!username.trim()) { Alert.alert('Kosa', 'Jaza jina la mtumiaji'); return; }
      if (password !== verifyPassword) { Alert.alert('Kosa', 'Nywila hazifanani'); return; }
      if (!acceptedTerms) { Alert.alert('Kosa', 'You must accept the Terms and Conditions'); return; }
    }

    let error: string | null;
    if (mode === 'login') {
      let loginEmail = email.trim().toLowerCase();
      if (!loginEmail.includes('@')) {
        // Check if it's a phone number (mostly digits)
        if (/^\+?\d+$/.test(loginEmail)) {
          loginEmail = `${loginEmail}@bongoapp.local`;
        } else {
          // It's a username lookup
          const { data: fetchedEmail, error: rpcError } = await import('../lib/supabase').then(m => m.supabase.rpc('get_user_email', { p_username: loginEmail }));
          if (fetchedEmail) {
            loginEmail = fetchedEmail;
          } else {
            Alert.alert('Kosa', 'Akaunti haijapatikana (Account not found)');
            return;
          }
        }
      }
      
      const session = useAuthStore.getState().session;
      const isGuest = session?.user?.is_anonymous || session?.user?.app_metadata?.provider === 'anonymous';
      
      if (isGuest) {
        Alert.alert(
          'Onyo (Warning)',
          'Ukiingia kwenye akaunti nyingine, utapoteza data na credits za akaunti hii ya muda (Guest). Je, unataka kuendelea? (Logging in will discard your guest data. Continue?)',
          [
            { text: 'Hapana (No)', style: 'cancel' },
            { 
              text: 'Ndiyo (Yes)', 
              style: 'destructive',
              onPress: async () => {
                const err = await signIn(loginEmail, password);
                if (err) Alert.alert('Imeshindwa', err);
              }
            }
          ]
        );
        return;
      }
      
      error = await signIn(loginEmail, password);
    } else {
      let finalEmail = email.trim().toLowerCase();
      if (!finalEmail.includes('@')) {
        if (/^\+?\d+$/.test(finalEmail)) {
          finalEmail = `${finalEmail}@bongoapp.local`;
        } else {
          Alert.alert('Kosa', 'Tafadhali weka barua pepe au namba ya simu sahihi');
          return;
        }
      }
      error = await signUp(finalEmail, password, username.trim().toLowerCase(), displayName.trim() || username.trim(), isArtist ? 'artist' : 'fan');
    }

    if (error) {
      Alert.alert('Imeshindwa', error);
    }
    // No need for router.back() or replace('/') here.
    // Our root _layout.tsx will automatically redirect the user to '/'
    // as soon as the session state changes!
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={styles.appName}>BONGO STREAM</Text>
          <Text style={styles.tagline}>
            {mode === 'login' ? 'Karibu tena! Ingia kwenye akaunti yako.' : 'Tengeneza akaunti mpya kuanza.'}
          </Text>
        </View>

        <View style={styles.formContainer}>
          {/* Sign Up fields */}
          {mode === 'signup' && (
            <>
              <Field styles={styles} COLORS={COLORS} value={displayName} onChange={setDisplayName} placeholder="Jina Kamili (Mf. John Doe)" icon="person-outline" />
              <Field styles={styles} COLORS={COLORS} value={username} onChange={t => setUsername(t.toLowerCase())} placeholder="Jina la Mtumiaji (@username)" icon="at-outline" />
            </>
          )}

          <Field 
            styles={styles} 
            COLORS={COLORS} 
            value={email} 
            onChange={setEmail} 
            placeholder={mode === 'login' ? "Namba ya Simu au Barua Pepe" : "Namba ya Simu au Barua Pepe"} 
            icon={mode === 'login' ? "person-outline" : "call-outline"} 
            keyboardType={mode === 'login' ? "default" : "email-address"} 
            autoCapitalize="none" 
          />

          {/* Password */}
          <View style={styles.fieldRow}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
            <TextInput
              style={styles.fieldInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Nywila yako"
              placeholderTextColor={COLORS.textTertiary}
              secureTextEntry={!pwVisible}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setPwVisible(!pwVisible)} style={styles.eyeIcon}>
              <Ionicons name={pwVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Verify Password (Signup Only) */}
          {mode === 'signup' && (
            <View style={styles.fieldRow}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.fieldInput}
                value={verifyPassword}
                onChangeText={setVerifyPassword}
                placeholder="Thibitisha nywila yako"
                placeholderTextColor={COLORS.textTertiary}
                secureTextEntry={!vpwVisible}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setVpwVisible(!vpwVisible)} style={styles.eyeIcon}>
                <Ionicons name={vpwVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textTertiary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Artist toggle & Terms */}
          {mode === 'signup' && (
            <View style={styles.signupExtras}>
              <TouchableOpacity
                style={[styles.artistToggle, isArtist && styles.artistToggleActive]}
                onPress={() => setIsArtist(!isArtist)}
                activeOpacity={0.7}
              >
                <View style={[styles.radio, isArtist && styles.radioActive]}>
                  {isArtist && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.artistToggleTitle, isArtist && { color: COLORS.gold }]}>
                    Mimi ni Msanii
                  </Text>
                  <Text style={styles.artistToggleSub}>Wezesha kupakia nyimbo zako</Text>
                </View>
                <Ionicons name="mic" size={20} color={isArtist ? COLORS.gold : COLORS.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.termsRow} onPress={() => setAcceptedTerms(!acceptedTerms)} activeOpacity={0.7}>
                <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}>
                  {acceptedTerms && <Ionicons name="checkmark" size={14} color={COLORS.black} />}
                </View>
                <View style={styles.termsTextRow}>
                  <Text style={styles.termsText}>Ninakubali </Text>
                  <TouchableOpacity onPress={() => router.push('/terms')}>
                    <Text style={styles.termsLink}>Vigezo & Masharti</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isLoading} activeOpacity={0.8}>
            {isLoading
              ? <ActivityIndicator color={COLORS.black} size="small" />
              : <Text style={styles.submitText}>{mode === 'login' ? 'INGIA' : 'JISAJILI'}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Footer Links */}
        <View style={styles.footer}>


          <View style={styles.divider} />

          <TouchableOpacity style={styles.switchModeBtn} onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            <Text style={styles.footerText}>
              {mode === 'login' ? "Hauna akaunti? " : "Unayo akaunti tayari? "}
              <Text style={styles.footerLink}>{mode === 'login' ? 'Tengeneza' : 'Ingia'}</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.offlineBtn} onPress={() => {
            const signInAnonymously = useAuthStore.getState().signInAnonymously;
            signInAnonymously().then(err => {
              if (err) Alert.alert('Kosa', err);
            });
          }} disabled={isLoading}>
            <Text style={styles.offlineText}>Endelea kama Mgeni (Guest)</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ styles, COLORS, value, onChange, placeholder, icon, keyboardType }: any) {
  return (
    <View style={styles.fieldRow}>
      <Ionicons name={icon} size={20} color={COLORS.textSecondary} />
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary}
        autoCapitalize="none"
        keyboardType={keyboardType}
      />
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.black 
  },
  content: { 
    padding: 24, 
    flexGrow: 1, 
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: { 
    marginBottom: 40,
    marginTop: 20
  },
  appName: { 
    color: COLORS.gold, 
    fontSize: 32, 
    fontWeight: '900', 
    letterSpacing: 2,
    marginBottom: 8
  },
  tagline: { 
    color: COLORS.textSecondary, 
    fontSize: 15, 
    lineHeight: 22 
  },
  formContainer: {
    gap: 16,
  },
  fieldRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.card, 
    borderRadius: 14, 
    paddingHorizontal: 16, 
    height: 60,
    gap: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fieldInput: { 
    flex: 1, 
    color: COLORS.textPrimary, 
    fontSize: 16,
    height: '100%',
  },
  eyeIcon: {
    padding: 8,
    marginRight: -8,
  },
  signupExtras: {
    marginTop: 8,
    gap: 16,
  },
  artistToggle: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.card, 
    borderRadius: 14, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: 'transparent', 
    gap: 14 
  },
  artistToggleActive: { 
    borderColor: COLORS.gold, 
    backgroundColor: COLORS.gold + '10' 
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.textTertiary,
    justifyContent: 'center',
    alignItems: 'center'
  },
  radioActive: {
    borderColor: COLORS.gold,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.gold,
  },
  artistToggleTitle: { 
    color: COLORS.textPrimary, 
    fontSize: 16, 
    fontWeight: '600' 
  },
  artistToggleSub: { 
    color: COLORS.textTertiary, 
    fontSize: 13, 
    marginTop: 4 
  },
  termsRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    paddingHorizontal: 4 
  },
  checkbox: { 
    width: 22, 
    height: 22, 
    borderRadius: 6, 
    borderWidth: 2, 
    borderColor: COLORS.textTertiary, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  checkboxActive: { 
    backgroundColor: COLORS.gold, 
    borderColor: COLORS.gold 
  },
  termsTextRow: { 
    flex: 1, 
    flexDirection: 'row', 
    flexWrap: 'wrap' 
  },
  termsText: { 
    color: COLORS.textSecondary, 
    fontSize: 14 
  },
  termsLink: { 
    color: COLORS.gold, 
    fontSize: 14, 
    fontWeight: '600' 
  },
  submitBtn: { 
    backgroundColor: COLORS.gold, 
    borderRadius: 14, 
    height: 60, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitText: { 
    color: COLORS.black, 
    fontWeight: '800', 
    fontSize: 16,
    letterSpacing: 1,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
    gap: 24,
  },
  switchModeBtn: {
    padding: 8,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  footerLink: {
    color: COLORS.gold,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    width: 40,
    backgroundColor: COLORS.divider,
  },
  offlineBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    padding: 8 
  },
  offlineText: { 
    color: COLORS.textTertiary, 
    fontSize: 14, 
    fontWeight: '500' 
  },
});
