import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const session = useAuthStore(s => s.session);
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (id) loadEvent();
  }, [id]);

  const loadEvent = async () => {
    try {
      const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
      if (error) throw error;
      setEvent(data);
    } catch (err: any) {
      Alert.alert('Error', err.message);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleGetTickets = () => {
    if (!session) {
      Alert.alert('Login Required', 'You must be logged in to get tickets.');
      useAuthStore.getState().disableOfflineMode();
      router.push('/auth');
      return;
    }

    Alert.alert('Confirm Purchase', `Get 1 ticket for ${event.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Confirm', 
        style: 'default',
        onPress: processTicket
      }
    ]);
  };

  const processTicket = async () => {
    setPurchasing(true);
    try {
      // Fetch user's current credits
      const { data: profile } = await supabase.from('profiles').select('credits').eq('id', session?.user.id).single();
      const ticketPrice = event.price || 50; // default to 50 credits if no price set

      if ((profile?.credits || 0) < ticketPrice) {
        Alert.alert('Insufficient Credits', `This ticket costs ${ticketPrice} credits. You only have ${profile?.credits || 0}. Please top up your wallet.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Get Credits', onPress: () => router.push('/buy-credits') }
        ]);
        return;
      }

      // Deduct credits
      const { error: deductError } = await supabase.from('profiles').update({
        credits: (profile?.credits || 0) - ticketPrice
      }).eq('id', session?.user.id);
      
      if (deductError) throw deductError;

      // Issue Ticket
      const ticketCode = `TIX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const { error } = await supabase.from('event_tickets').insert({
        event_id: event.id,
        user_id: session?.user.id,
        ticket_code: ticketCode
      });

      if (error) throw error;
      
      Alert.alert('Payment Successful!', 'Your ticket has been secured and your credits have been updated.', [
        { text: 'View Ticket', onPress: () => router.push('/my-tickets') }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  if (!event) return null;

  const eventDate = new Date(event.event_date);
  const formattedDate = eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Massive Hero Image */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: event.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient 
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)', COLORS.black]} 
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFillObject} 
          />
          
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Content Section */}
        <View style={styles.content}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons name="star" size={14} color={COLORS.black} />
              <Text style={styles.badgeText}>FEATURED EVENT</Text>
            </View>
          </View>

          <Text style={styles.title}>{event.title}</Text>
          
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <View style={styles.iconBox}>
                <Ionicons name="calendar" size={20} color={COLORS.gold} />
              </View>
              <View>
                <Text style={styles.infoLabel}>{formattedDate}</Text>
                <Text style={styles.infoSub}>{formattedTime} onwards</Text>
              </View>
            </View>

            <View style={[styles.infoRow, { marginTop: 16 }]}>
              <View style={styles.iconBox}>
                <Ionicons name="location" size={20} color={COLORS.gold} />
              </View>
              <View>
                <Text style={styles.infoLabel}>{event.location}</Text>
                <Text style={styles.infoSub}>Tanzania</Text>
              </View>
            </View>
          </View>

          <Text style={styles.aboutTitle}>About This Event</Text>
          <Text style={styles.aboutText}>
            Get ready for an unforgettable experience at {event.title}! Join us at {event.location} for a massive celebration of music and culture. More details and the full lineup will be announced soon. Grab your early bird tickets now before they sell out!
          </Text>

        </View>
      </ScrollView>

      {/* Floating Action Bar */}
      <View style={styles.floatingActionBar}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' }}>Price</Text>
          <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' }}>Tsh 10,000</Text>
        </View>
        <TouchableOpacity style={styles.buyBtn} onPress={handleGetTickets} disabled={purchasing}>
          {purchasing ? (
            <ActivityIndicator color={COLORS.black} size="small" />
          ) : (
            <>
              <Text style={styles.buyBtnText}>Get Tickets</Text>
              <Ionicons name="ticket" size={20} color={COLORS.black} style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  heroContainer: { width: '100%', height: 400, position: 'relative' },
  backBtn: { position: 'absolute', top: 60, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  
  content: { padding: 20, marginTop: -40 },
  badgeRow: { flexDirection: 'row', marginBottom: 16 },
  badge: { backgroundColor: COLORS.gold, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeText: { color: COLORS.black, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  
  title: { color: COLORS.textPrimary, fontSize: 32, fontWeight: '900', marginBottom: 24, lineHeight: 38 },
  
  infoBox: { backgroundColor: COLORS.card, padding: 20, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: COLORS.divider },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.cardAlt, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  infoLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  infoSub: { color: COLORS.textSecondary, fontSize: 13 },
  
  aboutTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 12 },
  aboutText: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 24 },

  floatingActionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.card, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: COLORS.divider, flexDirection: 'row', alignItems: 'center' },
  buyBtn: { backgroundColor: COLORS.gold, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 100, flexDirection: 'row', alignItems: 'center' },
  buyBtnText: { color: COLORS.black, fontSize: 16, fontWeight: '800' }
});
