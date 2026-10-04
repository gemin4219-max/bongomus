// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/themeStore';
import { Track } from '../constants';
import { useOfflineStore } from '../store/offlineStore';
import { useJamStore } from '../store/jamStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { useRewardedAd } from './ads/useRewardedAd';

type Props = {
  track: Track;
  isPlaying: boolean;
  onPress: () => void;
  onArtistPress?: () => void;
  onDelete?: () => void;
};

export default function TrackItem({ track, isPlaying, onPress, onArtistPress, onDelete }: Props) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const formatCount = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;

  const isDownloaded = useOfflineStore(s => s.isDownloaded(track.id));
  const isDownloading = useOfflineStore(s => s.isDownloading[track.id]);
  const downloadTrack = useOfflineStore(s => s.downloadTrack);

  const role = useJamStore(s => s.role);
  const broadcastAddTrack = useJamStore(s => s.broadcastAddTrack);
  const session = useAuthStore(s => s.session);

  const { showAd } = useRewardedAd();

  const handleDownload = () => {
    Alert.alert(
      "Pakua Wimbo",
      "Tazama tangazo fupi ili kupakua wimbo huu na kusikiliza bila intaneti.",
      [
        { text: "Ghairi", style: "cancel" },
        { 
          text: "Tazama", 
          onPress: () => {
            showAd(
              () => downloadTrack(track),
              () => {}
            );
          }
        }
      ]
    );
  };

  const handleReport = () => {
    Alert.alert(
      "Ripoti Hakimiliki",
      "Je, wimbo huu unatumia kazi yako bila ruhusa?",
      [
        { text: "Hapana", style: "cancel" },
        { 
          text: "Ndiyo, Ripoti", 
          style: "destructive",
          onPress: async () => {
            if (!session) {
              Alert.alert("Kosa", "Ingia kwenye akaunti yako ili kutoa ripoti.");
              return;
            }
            try {
              const { error } = await supabase.from('copyright_reports').insert({
                track_id: track.id,
                reporter_id: session.user.id,
                reason: 'Unauthorized use of copyrighted material reported from TrackItem'
              });
              if (error) throw error;
              Alert.alert("Asante", "Ripoti yako imepokelewa.");
            } catch (e: any) {
              Alert.alert("Kosa", e.message);
            }
          }
        }
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[styles.container, isPlaying && styles.playing]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Cover */}
      <View style={styles.coverWrap}>
        {track.cover_url
          ? <Image source={{ uri: track.cover_url }} style={styles.cover} transition={200} cachePolicy="memory-disk" />
          : <View style={[styles.cover, styles.coverPlaceholder]}>
              <Ionicons name="musical-note" size={20} color={COLORS.textTertiary} />
            </View>
        }
        {isPlaying && (
          <View style={styles.playingOverlay}>
            <Ionicons name="volume-high" size={18} color={COLORS.gold} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.title, isPlaying && styles.titlePlaying]} numberOfLines={1}>{track.title}</Text>
        <TouchableOpacity onPress={onArtistPress} disabled={!onArtistPress}>
          <Text style={styles.artist} numberOfLines={1}>
            {track.artist_name} · <Text style={styles.genre}>{track.genre}</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats & Actions */}
      <View style={styles.stats}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          {isDownloading ? (
            <ActivityIndicator size="small" color={COLORS.gold} style={{ transform: [{ scale: 0.7 }] }} />
          ) : isDownloaded ? (
            <Ionicons name="checkmark-circle" size={16} color={COLORS.gold} />
          ) : (
            <TouchableOpacity onPress={handleDownload} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="download-outline" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
          <Text style={styles.stat}>{formatCount(track.play_count)} ▶</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: onDelete ? 4 : 0 }}>
          <Ionicons name="heart" size={10} color={COLORS.textTertiary} />
          <Text style={styles.stat}>{formatCount(track.like_count)}</Text>
        </View>

        <TouchableOpacity onPress={handleReport} style={[styles.deleteBtn, { backgroundColor: 'transparent', padding: 0 }]}>
          <Ionicons name="warning" size={14} color="#ff5555" />
        </TouchableOpacity>
        
        {onDelete && (
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={16} color={COLORS.error} />
          </TouchableOpacity>
        )}

        {role === 'guest' && (
          <TouchableOpacity 
            onPress={() => broadcastAddTrack(track)} 
            style={[styles.deleteBtn, { backgroundColor: COLORS.gold + '20', marginTop: 8 }]}
          >
            <Ionicons name="car-sport" size={16} color={COLORS.gold} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  playing: { backgroundColor: COLORS.gold + '10' },
  coverWrap: { position: 'relative' },
  cover: { width: 52, height: 52, borderRadius: 8, backgroundColor: COLORS.card },
  coverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  playingOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  title: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  titlePlaying: { color: COLORS.gold },
  artist: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  genre: { color: COLORS.textTertiary },
  stats: { alignItems: 'flex-end', justifyContent: 'center' },
  stat: { color: COLORS.textTertiary, fontSize: 11 },
  deleteBtn: { padding: 4, marginTop: 4, backgroundColor: 'rgba(255, 60, 60, 0.1)', borderRadius: 12 },
});
