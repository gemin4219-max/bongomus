// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';


export default function AdminBattlesScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const [battles, setBattles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create form state
  const [title, setTitle] = useState('');
  const [track1Id, setTrack1Id] = useState('');
  const [track2Id, setTrack2Id] = useState('');
  const [days, setDays] = useState('7');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadBattles();
  }, []);

  const loadBattles = async () => {
    setLoading(true);
    const { data } = await supabase.from('song_battles').select('*').order('created_at', { ascending: false });
    if (data) setBattles(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!title || !track1Id || !track2Id || !days) {
      Alert.alert("Error", "Please fill all fields.");
      return;
    }

    setCreating(true);
    
    // Calculate end time
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + parseInt(days));

    const { error } = await supabase.from('song_battles').insert({
      title,
      track1_id: track1Id,
      track2_id: track2Id,
      end_time: endTime.toISOString()
    });

    if (error) {
      Alert.alert("Failed to Create", error.message);
    } else {
      Alert.alert("Success", "Battle created!");
      setTitle('');
      setTrack1Id('');
      setTrack2Id('');
      setDays('7');
      loadBattles();
    }
    setCreating(false);
  };

  const handleEndBattle = async (battleId: string, track1Votes: number, track2Votes: number, t1Id: string, t2Id: string) => {
    Alert.alert("End Battle", "Are you sure you want to end this battle early?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "End", 
        onPress: async () => {
          let winnerId = null;
          if (track1Votes > track2Votes) winnerId = t1Id;
          else if (track2Votes > track1Votes) winnerId = t2Id;

          const { error } = await supabase.from('song_battles').update({
            status: 'completed',
            winner_id: winnerId,
            end_time: new Date().toISOString()
          }).eq('id', battleId);

          if (!error) loadBattles();
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Manage Battles', headerStyle: { backgroundColor: COLORS.black }, headerTintColor: COLORS.gold }} />
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: 'Manage Battles', headerStyle: { backgroundColor: COLORS.black }, headerTintColor: COLORS.gold }} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create New Battle</Text>
        
        <TextInput style={styles.input} placeholder="Battle Title (e.g. Bongo Flava Kings)" placeholderTextColor={COLORS.textTertiary} value={title} onChangeText={setTitle} />
        <TextInput style={styles.input} placeholder="Track 1 ID (UUID)" placeholderTextColor={COLORS.textTertiary} value={track1Id} onChangeText={setTrack1Id} />
        <TextInput style={styles.input} placeholder="Track 2 ID (UUID)" placeholderTextColor={COLORS.textTertiary} value={track2Id} onChangeText={setTrack2Id} />
        <TextInput style={styles.input} placeholder="Duration in Days" placeholderTextColor={COLORS.textTertiary} keyboardType="numeric" value={days} onChangeText={setDays} />

        <TouchableOpacity style={styles.btn} onPress={handleCreate} disabled={creating}>
          {creating ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.btnText}>Launch Battle</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>All Battles</Text>

      {battles.map(b => (
        <View key={b.id} style={styles.battleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bTitle}>{b.title}</Text>
            <Text style={styles.bStats}>Status: {b.status}</Text>
            <Text style={styles.bStats}>T1 Votes: {b.track1_votes} | T2 Votes: {b.track2_votes}</Text>
            <Text style={styles.bStats}>Ends: {new Date(b.end_time).toLocaleDateString()}</Text>
          </View>
          
          {b.status === 'active' && (
            <TouchableOpacity 
              style={styles.endBtn}
              onPress={() => handleEndBattle(b.id, b.track1_votes, b.track2_votes, b.track1_id, b.track2_id)}
            >
              <Text style={styles.endBtnText}>End Now</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

    </ScrollView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  center: { flex: 1, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: COLORS.black, padding: 16 },
  
  card: { backgroundColor: COLORS.card, padding: 20, borderRadius: 16, marginBottom: 32 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  input: { backgroundColor: COLORS.black, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.divider, borderRadius: 12, padding: 14, marginBottom: 12 },
  btn: { backgroundColor: COLORS.gold, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnText: { color: COLORS.black, fontWeight: '800', fontSize: 16 },
  
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  
  battleRow: { backgroundColor: COLORS.cardAlt, padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  bTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  bStats: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 2 },
  
  endBtn: { backgroundColor: 'rgba(255, 59, 48, 0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  endBtnText: { color: COLORS.error, fontWeight: '700', fontSize: 12 },
});
