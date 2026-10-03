import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GlassView as BlurView } from '@/components/GlassView';
import { useJamStore } from '../store/jamStore';
import { usePlayerStore } from '../store/playerStore';
import GlassBackButton from '../components/GlassBackButton';

const COLORS = {
  background: '#050505',
  card: '#111111',
  cardAlt: '#1a1a1a',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  gold: '#D4AF37',
  goldDark: '#AA8C2C',
};

export default function JamSessionScreen() {
  const router = useRouter();
  const { sessionCode, role, connectedGuests, jamQueue, startJamSession, joinJamSession, leaveJamSession } = useJamStore();
  const playerQueue = usePlayerStore(state => state.queue);
  const currentTrack = usePlayerStore(state => state.currentTrack);
  
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleStart = () => {
    startJamSession();
  };

  const handleJoin = async () => {
    if (joinCodeInput.trim().length < 4) return;
    setIsJoining(true);
    const success = await joinJamSession(joinCodeInput.trim());
    setIsJoining(false);
    if (!success) {
      alert("Failed to join. Invalid code or network error.");
    }
  };

  const handleLeave = () => {
    leaveJamSession();
  };

  const renderActiveSession = () => {
    const isHost = role === 'host';
    const queueToDisplay = isHost ? playerQueue : jamQueue;
    
    return (
      <View style={{ flex: 1, paddingTop: 40, paddingHorizontal: 24 }}>
        <View style={styles.headerRow}>
          <GlassBackButton onPress={() => router.back()} />
          <Text style={styles.screenTitle}>{isHost ? 'Hosting Jam' : 'Joined Jam'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>SESSION CODE</Text>
          <Text style={styles.codeText}>{sessionCode}</Text>
          <Text style={styles.guestCountText}>
            <Ionicons name="people" size={16} color={COLORS.gold} /> {connectedGuests} Guest(s) Connected
          </Text>
        </View>

        {isHost && (
          <Text style={styles.hostHelperText}>
            You are the driver. Anyone who joins with this code can add songs to your player queue instantly!
          </Text>
        )}
        {!isHost && (
          <Text style={styles.hostHelperText}>
            You are connected! Browse the app and tap "Add to Jam" on any song.
          </Text>
        )}

        <View style={styles.queueHeader}>
          <Text style={styles.queueTitle}>Upcoming in Queue</Text>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {currentTrack && (
            <View style={[styles.queueItem, { borderColor: COLORS.gold, borderWidth: 1 }]}>
              <Ionicons name="volume-high" size={24} color={COLORS.gold} />
              <View style={styles.queueItemInfo}>
                <Text style={styles.queueItemTitle} numberOfLines={1}>{currentTrack.title}</Text>
                <Text style={styles.queueItemArtist} numberOfLines={1}>{currentTrack.artist_name}</Text>
              </View>
            </View>
          )}

          {queueToDisplay.length === 0 && !currentTrack && (
            <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 }}>Queue is empty. Add some tracks!</Text>
          )}

          {queueToDisplay.map((track, idx) => {
            // If it's the current track, we already displayed it
            if (currentTrack && track.id === currentTrack.id) return null;
            return (
              <View key={`${track.id}-${idx}`} style={styles.queueItem}>
                <Text style={styles.queueItemIndex}>{idx + 1}</Text>
                <View style={styles.queueItemInfo}>
                  <Text style={styles.queueItemTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.queueItemArtist} numberOfLines={1}>{track.artist_name}</Text>
                </View>
              </View>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>

        <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
          <Text style={styles.leaveBtnText}>End Session</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderLobby = () => {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingTop: 40, paddingHorizontal: 24 }}>
          <View style={styles.headerRow}>
            <GlassBackButton onPress={() => router.back()} />
            <View style={{ width: 40 }} />
          </View>

          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={styles.heroWrap}>
              <Ionicons name="car-sport" size={64} color={COLORS.gold} />
              <Text style={styles.heroTitle}>Jam Sessions</Text>
              <Text style={styles.heroSub}>Shared car queues with no friction. No accounts needed, just pure music.</Text>
            </View>

            <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
              <LinearGradient colors={['#D4AF37', '#AA8C2C']} style={StyleSheet.absoluteFill} />
              <Text style={styles.startBtnText}>Start as Driver</Text>
            </TouchableOpacity>

            <View style={styles.dividerWrap}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR JOIN</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.joinWrap}>
              <TextInput 
                style={styles.joinInput}
                placeholder="Enter 4-Digit Code"
                placeholderTextColor={COLORS.textSecondary}
                value={joinCodeInput}
                onChangeText={text => setJoinCodeInput(text.toUpperCase())}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} disabled={isJoining || joinCodeInput.length < 4}>
                {isJoining ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.joinBtnText}>Join Jam</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  };

  return (
    <LinearGradient colors={['#1a1a1a', COLORS.background]} style={styles.container}>
      {sessionCode ? renderActiveSession() : renderLobby()}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { padding: 8, marginLeft: -8 },
  screenTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  
  heroWrap: { alignItems: 'center', marginBottom: 40 },
  heroTitle: { color: COLORS.textPrimary, fontSize: 32, fontWeight: '900', marginTop: 16, marginBottom: 8 },
  heroSub: { color: COLORS.textSecondary, fontSize: 16, textAlign: 'center', lineHeight: 24, paddingHorizontal: 20 },
  
  startBtn: { height: 60, borderRadius: 30, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  startBtnText: { color: COLORS.background, fontSize: 18, fontWeight: '800' },
  
  dividerWrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 32 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.cardAlt },
  dividerText: { color: COLORS.textSecondary, paddingHorizontal: 16, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  
  joinWrap: { gap: 16 },
  joinInput: { backgroundColor: COLORS.cardAlt, height: 60, borderRadius: 16, color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: 8, borderWidth: 1, borderColor: '#333' },
  joinBtn: { height: 60, borderRadius: 16, backgroundColor: COLORS.textPrimary, alignItems: 'center', justifyContent: 'center' },
  joinBtnText: { color: COLORS.background, fontSize: 18, fontWeight: '800' },
  
  codeContainer: { backgroundColor: COLORS.cardAlt, borderRadius: 24, padding: 32, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#333' },
  codeLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  codeText: { color: COLORS.gold, fontSize: 48, fontWeight: '900', letterSpacing: 12, marginBottom: 16 },
  guestCountText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  
  hostHelperText: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 16 },
  
  queueHeader: { marginBottom: 16 },
  queueTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  
  queueItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardAlt, padding: 16, borderRadius: 16, marginBottom: 12, gap: 16 },
  queueItemIndex: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '800', width: 24 },
  queueItemInfo: { flex: 1 },
  queueItemTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  queueItemArtist: { color: COLORS.textSecondary, fontSize: 14 },
  
  leaveBtn: { backgroundColor: '#FF3B30', height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  leaveBtnText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
});
