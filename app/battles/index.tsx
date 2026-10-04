// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';

import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');

export default function BattlesScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const profile = useAuthStore(s => s.profile);
  
  const [battles, setBattles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadBattles();
    }, [])
  );

  const loadBattles = async () => {
    setLoading(true);
    // Fetch active battles with track details
    const { data: battlesData } = await supabase
      .from('song_battles')
      .select(`
        *,
        track1:tracks!song_battles_track1_id_fkey(*, profile:profiles!tracks_user_id_fkey(*)),
        track2:tracks!song_battles_track2_id_fkey(*, profile:profiles!tracks_user_id_fkey(*))
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (battlesData) setBattles(battlesData);
    setLoading(false);
  };

  const handleVote = async (battleId: string, trackId: string, trackName: string) => {
    if (!profile) {
      Alert.alert("Login Required", "You must be logged in to vote.");
      return;
    }

    if ((profile.credits || 0) < 10) {
      Alert.alert(
        "Insufficient Credits", 
        "It costs 10 Bongo Credits to vote. You don't have enough.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Buy Credits", onPress: () => router.push('/buy-credits') }
        ]
      );
      return;
    }

    Alert.alert(
      "Confirm Vote",
      `Spend 10 Bongo Credits to vote for "${trackName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Vote",
          onPress: async () => {
            setVoting(battleId);
            
            // Call RPC
            const { error } = await supabase.rpc('vote_in_battle', {
              p_battle_id: battleId,
              p_track_id: trackId,
              p_amount: 10
            });

            if (error) {
              Alert.alert("Vote Failed", error.message);
            } else {
              // Update local profile credits so UI updates immediately
              useAuthStore.setState({ profile: { ...profile, credits: (profile.credits || 0) - 10 } });
              Alert.alert("Success", "Your vote has been counted!");
              loadBattles();
            }
            setVoting(null);
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Bongo Verzuz', headerShown: true, headerStyle: { backgroundColor: COLORS.black }, headerTintColor: COLORS.gold }} />
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Stack.Screen options={{ title: 'Bongo Verzuz', headerShown: true, headerStyle: { backgroundColor: COLORS.black }, headerTintColor: COLORS.gold, }} />
      
      <View style={styles.headerArea}>
        <Text style={styles.headerTitle}>BONGO VERZUZ 🥊</Text>
        <Text style={styles.headerSub}>Vote for the best track. Winners take the pot!</Text>
        <View style={styles.creditBadge}>
          <Ionicons name="diamond" size={14} color={COLORS.gold} />
          <Text style={styles.creditText}>Your Credits: {profile?.credits || 0}</Text>
        </View>
      </View>

      {battles.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={48} color={COLORS.textTertiary} />
          <Text style={styles.emptyText}>No active battles right now.</Text>
        </View>
      ) : (
        battles.map(battle => {
          const totalVotes = (battle.track1_votes || 0) + (battle.track2_votes || 0);
          const t1Percent = totalVotes > 0 ? ((battle.track1_votes || 0) / totalVotes) * 100 : 50;
          const t2Percent = totalVotes > 0 ? ((battle.track2_votes || 0) / totalVotes) * 100 : 50;

          return (
            <View key={battle.id} style={styles.battleCard}>
              <Text style={styles.battleTitle}>{battle.title}</Text>
              
              <View style={styles.vsContainer}>
                {/* Track 1 */}
                <View style={styles.trackCol}>
                  <Image source={{ uri: battle.track1?.cover_url }} style={styles.trackImg} />
                  <Text style={styles.trackName} numberOfLines={1}>{battle.track1?.title}</Text>
                  <Text style={styles.artistName} numberOfLines={1}>{battle.track1?.profile?.display_name}</Text>
                  
                  <TouchableOpacity 
                    style={[styles.voteBtn, styles.voteBtn1]} 
                    disabled={voting === battle.id}
                    onPress={() => handleVote(battle.id, battle.track1_id, battle.track1?.title)}
                  >
                    <Text style={styles.voteBtnText}>VOTE (10 Crd)</Text>
                  </TouchableOpacity>
                  <Text style={styles.voteCount}>{battle.track1_votes} Votes</Text>
                </View>

                {/* VS Badge */}
                <View style={styles.vsBadge}>
                  <Text style={styles.vsText}>VS</Text>
                </View>

                {/* Track 2 */}
                <View style={styles.trackCol}>
                  <Image source={{ uri: battle.track2?.cover_url }} style={styles.trackImg} />
                  <Text style={styles.trackName} numberOfLines={1}>{battle.track2?.title}</Text>
                  <Text style={styles.artistName} numberOfLines={1}>{battle.track2?.profile?.display_name}</Text>
                  
                  <TouchableOpacity 
                    style={[styles.voteBtn, styles.voteBtn2]} 
                    disabled={voting === battle.id}
                    onPress={() => handleVote(battle.id, battle.track2_id, battle.track2?.title)}
                  >
                    <Text style={styles.voteBtnText}>VOTE (10 Crd)</Text>
                  </TouchableOpacity>
                  <Text style={styles.voteCount}>{battle.track2_votes} Votes</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressT1, { width: `${t1Percent}%` }]} />
                <View style={[styles.progressT2, { width: `${t2Percent}%` }]} />
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  center: { flex: 1, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: COLORS.black, padding: 16 },
  headerArea: { alignItems: 'center', marginVertical: 20 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '900', marginBottom: 8, fontStyle: 'italic' },
  headerSub: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 16 },
  creditBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212,175,55,0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
  creditText: { color: COLORS.gold, fontWeight: '800', fontSize: 14 },
  
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: COLORS.textSecondary, marginTop: 12 },

  battleCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: COLORS.divider },
  battleTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 20 },
  
  vsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  trackCol: { flex: 1, alignItems: 'center', maxWidth: '45%' },
  trackImg: { width: 100, height: 100, borderRadius: 16, marginBottom: 12, backgroundColor: COLORS.cardAlt },
  trackName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  artistName: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 16 },
  
  voteBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 8 },
  voteBtn1: { backgroundColor: '#FF3B30' },
  voteBtn2: { backgroundColor: '#007AFF' },
  voteBtnText: { color: COLORS.textPrimary, fontWeight: '800', fontSize: 12 },
  voteCount: { color: COLORS.textTertiary, fontSize: 12, fontWeight: '600' },

  vsBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.gold, position: 'absolute', left: '50%', marginLeft: -20, zIndex: 10, top: 30 },
  vsText: { color: COLORS.gold, fontWeight: '900', fontStyle: 'italic', fontSize: 14 },

  progressBarContainer: { height: 12, borderRadius: 6, flexDirection: 'row', overflow: 'hidden', marginTop: 10, backgroundColor: COLORS.cardAlt },
  progressT1: { backgroundColor: '#FF3B30', height: '100%' },
  progressT2: { backgroundColor: '#007AFF', height: '100%' },
});
