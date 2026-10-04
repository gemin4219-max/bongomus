// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassView as BlurView } from '@/components/GlassView';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { LinearGradient } from 'expo-linear-gradient';


export default function BuyCreditsScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { session, profile, fetchProfile } = useAuthStore();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [creditsToBuy, setCreditsToBuy] = useState('1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Listen for transaction status changes via Supabase Realtime
  useEffect(() => {
    if (!transactionId) return;

    const channel = supabase.channel(`public:transactions:id=eq.${transactionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'transactions',
        filter: `id=eq.${transactionId}`
      }, (payload) => {
        const newStatus = payload.new.status;
        if (newStatus === 'completed') {
          setIsProcessing(false);
          Alert.alert("Success!", "Payment received. You now have 1 new credit!", [
            { text: "Awesome", onPress: () => {
              if (session?.user.id) fetchProfile(session.user.id);
              router.back();
            }}
          ]);
        } else if (newStatus === 'failed') {
          setIsProcessing(false);
          Alert.alert("Payment Failed", "The payment was cancelled or failed.");
          setTransactionId(null);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [transactionId]);

  const handlePayment = async () => {
    const cleanPhone = phoneNumber.replace(/\s+/g, '');

    if (!cleanPhone || cleanPhone.length < 9) {
      Alert.alert("Invalid Phone", "Please enter a valid mobile money number.");
      return;
    }

    // Detect Vodacom Tanzania prefixes (075, 076, 074)
    const isVodacom = /^(?:\+?255|0)?(75|76|74)\d{7}$/.test(cleanPhone);
    if (isVodacom) {
      Alert.alert(
        "Network Not Supported", 
        "Vodacom M-Pesa is not supported right now. Please use Airtel Money, HaloPesa, or Tigo Pesa."
      );
      return;
    }
    
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { phoneNumber: cleanPhone, credits: creditsToBuy }
      });

      if (error) throw new Error(error.message);
      if (!data || !data.success) throw new Error(data?.error || "Payment initiation failed");

      setTransactionId(data.transactionId);
      const totalAmount = (parseInt(creditsToBuy) || 1) * 500;
      Alert.alert("Check Your Phone", `Please enter your Mobile Money PIN on your phone to complete the purchase of ${totalAmount} TZS.`);
      
    } catch (e: any) {
      setIsProcessing(false);
      Alert.alert("Error", e.message);
    }
  };

  const handleVerifyPayments = async () => {
    setIsProcessing(true);
    try {
      if (!session?.user.id) return;
      
      const { data: pendingTxs, error: fetchError } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('status', 'pending');
        
      if (fetchError) throw fetchError;
      
      if (!pendingTxs || pendingTxs.length === 0) {
        Alert.alert("All Good", "You don't have any pending or missing payments to recover.");
        setIsProcessing(false);
        return;
      }
      
      let recovered = 0;
      for (const tx of pendingTxs) {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { transactionId: tx.id }
        });
        if (data?.success && data.message.includes('awarded')) {
          recovered++;
        }
      }
      
      if (recovered > 0) {
        if (session.user.id) fetchProfile(session.user.id);
        Alert.alert("Success!", `We found and recovered ${recovered} missing payment(s)! Your credits have been updated.`);
      } else {
        Alert.alert("Status", "We checked your pending payments but none of them have been successfully completed yet.");
      }
      
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to verify payments");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
      
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Get Credits</Text>
            <View style={{ width: 28 }} />
          </View>

          <BlurView intensity={30} tint="dark" style={[styles.balanceCard]}>
            <Ionicons name="diamond" size={32} color={COLORS.gold} />
            <Text style={styles.balanceTitle}>Current Balance</Text>
            <Text style={styles.balanceAmount}>{profile?.credits || 0} Credits</Text>
            
            <TouchableOpacity onPress={handleVerifyPayments} disabled={isProcessing} style={styles.verifyBtn}>
              <Ionicons name="refresh-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.verifyText}>Verify Missing Payments</Text>
            </TouchableOpacity>

            {profile?.role === 'admin' && (
              <TouchableOpacity 
                onPress={async () => {
                  const { error } = await supabase.rpc('add_credits', { user_id: session?.user.id, amount: 1 });
                  if (!error) {
                    Alert.alert("Gift Claimed!", "You received 1 free credit.");
                    if (session?.user.id) fetchProfile(session.user.id);
                  } else {
                    Alert.alert("Error", error.message);
                  }
                }} 
                style={[styles.verifyBtn, { marginTop: 12, backgroundColor: 'rgba(212, 175, 55, 0.1)', borderColor: COLORS.gold, borderWidth: 1 }]}
              >
                <Ionicons name="gift" size={14} color={COLORS.gold} />
                <Text style={[styles.verifyText, { color: COLORS.gold }]}>Claim Free Credit (Gift)</Text>
              </TouchableOpacity>
            )}
          </BlurView>

          <BlurView intensity={30} tint="dark" style={[styles.packageCard]}>
            <View style={styles.packageHeader}>
              <Text style={styles.packageTitle}>Need more credits?</Text>
            </View>
            <Text style={styles.packageDesc}>Generate fully produced songs or upload custom audio. 1 Credit = 500 TZS (Equivalent to 2 full songs!).</Text>
            
            <View style={styles.divider} />

            <Text style={styles.label}>How many credits?</Text>
            <View style={[styles.inputRow, { marginBottom: 16 }]}>
              <Ionicons name="diamond" size={20} color={COLORS.gold} />
              <TextInput 
                style={styles.input} 
                placeholder="Number of credits (e.g. 2)" 
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="number-pad"
                value={creditsToBuy}
                onChangeText={setCreditsToBuy}
                editable={!isProcessing}
              />
            </View>
            
            <Text style={styles.label}>Pay with Mobile Money <Text style={{ color: COLORS.gold, fontSize: 12 }}>(Airtel, Halopesa & Tigo)</Text></Text>
            <View style={styles.inputRow}>
              <Ionicons name="phone-portrait-outline" size={20} color={COLORS.gold} />
              <TextInput 
                style={styles.input} 
                placeholder="e.g. 0754000000" 
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                editable={!isProcessing}
              />
            </View>

            <TouchableOpacity 
              style={[isProcessing && { opacity: 0.7 }, { borderRadius: 12, overflow: 'hidden', marginTop: 20 }]} 
              onPress={handlePayment} 
              disabled={isProcessing}
            >
              <LinearGradient 
                colors={['#FF2A75', '#FF512F']} 
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} 
                style={{ padding: 16, alignItems: 'center' }}
              >
                {isProcessing ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator color="#fff" />
                    <Text style={[styles.payBtnText, { color: '#fff' }]}>Waiting for PIN...</Text>
                  </View>
                ) : (
                  <Text style={[styles.payBtnText, { color: '#fff' }]}>Pay {(parseInt(creditsToBuy) || 1) * 500} TZS</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.secureWrap}>
              <Ionicons name="lock-closed" size={14} color={COLORS.textTertiary} />
              <Text style={styles.secureText}>Secure Payment</Text>
            </View>
          </BlurView>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 0, paddingTop: 44, paddingBottom: 20 },
  backBtn: { padding: 4, marginLeft: -4 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  balanceCard: { alignItems: 'center', padding: 24, borderRadius: 16, marginBottom: 24, overflow: 'hidden' },
  balanceTitle: { color: COLORS.textSecondary, fontSize: 14, marginTop: 12, marginBottom: 4 },
  balanceAmount: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '900' },
  packageCard: { borderRadius: 16, padding: 20, overflow: 'hidden' },
  packageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  packageTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  packagePrice: { color: COLORS.gold, fontSize: 18, fontWeight: '900' },
  packageDesc: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 20 },
  label: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 16 },
  payBtn: { backgroundColor: COLORS.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  payBtnText: { color: COLORS.black, fontSize: 16, fontWeight: '800' },
  secureWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  secureText: { color: COLORS.textTertiary, fontSize: 12 },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20 },
  verifyText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' }
});
