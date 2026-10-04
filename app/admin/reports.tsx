// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { Image } from 'expo-image';

export default function AdminReportsScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      // Step 1: Fetch reports with track info
      const { data: reportsData, error } = await supabase
        .from('copyright_reports')
        .select('*, tracks(*)')
        .order('created_at', { ascending: false });
        
      if (error) throw error;

      // Step 2: Manually fetch reporter usernames
      const reporterIds = [...new Set((reportsData || []).map((r: any) => r.reporter_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (reporterIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', reporterIds);
        (profilesData || []).forEach((p: any) => { profileMap[p.id] = p.username; });
      }

      const merged = (reportsData || []).map((r: any) => ({
        ...r,
        reporter: { username: profileMap[r.reporter_id] || 'Unknown' }
      }));

      setReports(merged);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const { error } = await supabase
        .from('copyright_reports')
        .update({ status: 'dismissed' })
        .eq('id', id);
      if (error) throw error;
      loadReports();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteTrack = async (reportId: string, trackId: string) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this track for copyright infringement?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Track', style: 'destructive', onPress: async () => {
          try {
            // Delete track (this will cascade delete the report if DB is set up, or we update report manually)
            const { error: delError } = await supabase.from('tracks').delete().eq('id', trackId);
            if (delError) throw delError;
            
            // Update report
            await supabase.from('copyright_reports').update({ status: 'resolved' }).eq('id', reportId);
            loadReports();
            Alert.alert('Success', 'Track deleted permanently.');
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>DMCA Reports</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {reports.length === 0 ? (
            <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 }}>No reports found.</Text>
          ) : (
            reports.map(report => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{report.status.toUpperCase()}</Text>
                </View>
                
                <Text style={styles.reason}>Reported by @{report.reporter?.username || 'Unknown'}</Text>
                <Text style={styles.date}>{new Date(report.created_at).toLocaleString()}</Text>
                
                {report.tracks ? (
                  <View style={styles.trackInfo}>
                    <Image source={{ uri: report.tracks.cover_url }} style={styles.trackCover} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.trackTitle}>{report.tracks.title}</Text>
                      <Text style={styles.trackArtist}>{report.tracks.artist_name}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={{ color: COLORS.textTertiary, marginTop: 12 }}>Track already deleted.</Text>
                )}

                <View style={styles.actions}>
                  {report.status === 'pending' && report.tracks && (
                    <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDeleteTrack(report.id, report.track_id)}>
                      <Text style={styles.deleteBtnText}>Take Down Track</Text>
                    </TouchableOpacity>
                  )}
                  {report.status === 'pending' && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleDismiss(report.id)}>
                      <Text style={styles.actionBtnText}>Dismiss</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 20, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 100 },
  
  reportCard: { backgroundColor: COLORS.card, padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.divider },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 8 },
  statusText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '800' },
  reason: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  date: { color: COLORS.textTertiary, fontSize: 12, marginTop: 4 },
  
  trackInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 16, padding: 12, backgroundColor: COLORS.cardAlt, borderRadius: 12 },
  trackCover: { width: 40, height: 40, borderRadius: 8, marginRight: 12 },
  trackTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  trackArtist: { color: COLORS.textSecondary, fontSize: 12 },
  
  actions: { flexDirection: 'row', marginTop: 16, gap: 12 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.cardAlt, alignItems: 'center' },
  actionBtnText: { color: COLORS.textPrimary, fontWeight: '700' },
  deleteBtn: { backgroundColor: 'rgba(255,50,50,0.15)' },
  deleteBtnText: { color: '#ff5555', fontWeight: '700' }
});
