import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView as BlurView } from '@/components/GlassView';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Track } from '../constants';
import { useThemeStore } from '../store/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassBackButton from './GlassBackButton';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  track: Track | null;
  quote?: string;
}

const FONT_STYLES = [
  { label: 'Bold',   fontFamily: 'Outfit_900Black',    fontStyle: 'normal' as const },
  { label: 'Light',  fontFamily: 'Outfit_400Regular',  fontStyle: 'normal' as const },
  { label: 'Semi',   fontFamily: 'Outfit_600SemiBold', fontStyle: 'normal' as const },
  { label: 'Italic', fontFamily: 'Outfit_700Bold',     fontStyle: 'italic' as const },
  { label: 'Script', fontFamily: 'serif',              fontStyle: 'normal' as const },
  { label: 'Mono',   fontFamily: 'monospace',          fontStyle: 'normal' as const },
];

export default function ShareCardModal({ visible, onClose, track, quote: initialQuote }: Props) {
  const { COLORS } = useThemeStore();
  const insets = useSafeAreaInsets();
  const viewShotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  const [selectedFontIndex, setSelectedFontIndex] = useState(0);

  const handleShare = async () => {
    if (!viewShotRef.current?.capture) return;
    try {
      setSharing(true);
      const uri = await viewShotRef.current.capture();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: `Share ${track?.title}`,
          mimeType: 'image/png',
        });
      }
    } catch (e) {
      console.error('Error sharing card:', e);
    } finally {
      setSharing(false);
      onClose();
    }
  };

  if (!track) return null;

  const quote = initialQuote || "Maybe you should wish it more\nMaybe the world is yours";
  const activeFont = FONT_STYLES[selectedFontIndex];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(10, 10, 15, 0.98)' }}>

        {/* ── Header ── */}
        <View style={[styles.header, { top: insets.top > 0 ? insets.top : 20 }]}>
          <GlassBackButton onPress={onClose} icon="close" />
          <Text style={styles.headerTitle}>Share Quote</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* ── Font Style Picker ── */}
        <View style={styles.fontPickerSection}>
          <Text style={styles.fontPickerLabel}>Font Style</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.fontPickerRow}
          >
            {FONT_STYLES.map((f, idx) => {
              const isSelected = idx === selectedFontIndex;
              return (
                <TouchableOpacity
                  key={f.label}
                  onPress={() => setSelectedFontIndex(idx)}
                  style={[styles.fontPill, isSelected && styles.fontPillActive]}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.fontPillText,
                    isSelected && styles.fontPillTextActive,
                    { fontFamily: f.fontFamily, fontStyle: f.fontStyle },
                  ]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Share Card ── */}
        <View style={styles.cardContainer}>
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
            <View style={[styles.shareCard, { backgroundColor: '#1c1c28' }]}>
              {/* Normal top row */}
              <View style={styles.cardHeader}>
                <Image source={{ uri: track.cover_url }} style={styles.trackCover} />
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.artistName} numberOfLines={1}>{track.artist_name}</Text>
                </View>
              </View>

              {/* Lyric quote */}
              <View style={styles.quoteWrap}>
                {/* Quotation mark decoration */}
                <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 80, lineHeight: 70, fontFamily: 'serif', marginBottom: 4 }}>"</Text>
                <Text style={[styles.quoteText, {
                  fontFamily: activeFont.fontFamily,
                  fontStyle: activeFont.fontStyle,
                }]} numberOfLines={6}>
                  {quote}
                </Text>
              </View>

              {/* Watermark */}
              <View style={styles.watermarkBox}>
                <Image source={require('../assets/icon.png')} style={{ width: 22, height: 22, marginRight: 8, borderRadius: 5 }} />
                <Text style={styles.watermarkText}>Bongo Stream</Text>
              </View>
            </View>
          </ViewShot>
        </View>

        {/* ── Share Button ── */}
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
          {sharing ? (
            <ActivityIndicator color={COLORS.black} />
          ) : (
            <>
              <Ionicons name="share-social" size={22} color={COLORS.black} style={{ marginRight: 8 }} />
              <Text style={styles.shareBtnText}>Share to Story</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  closeBtn: { width: 44, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },

  fontPickerSection: {
    width: width,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  fontPickerLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  fontPickerRow: { gap: 8, paddingHorizontal: 4 },
  fontPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  fontPillActive: {
    backgroundColor: 'rgba(212,175,55,0.9)',
    borderColor: 'rgba(212,175,55,1)',
  },
  fontPillText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  fontPillTextActive: { color: '#000', fontWeight: '800' },

  cardContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  shareCard: {
    width: width * 0.85,
    aspectRatio: 3 / 4,
    borderRadius: 24,
    overflow: 'hidden',
    padding: 24,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trackCover: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  trackInfo: { flex: 1 },
  trackTitle: { fontFamily: 'Outfit_800ExtraBold', color: '#fff', fontSize: 15, marginBottom: 2 },
  artistName: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '500' },
  quoteWrap: { flex: 1, justifyContent: 'center', paddingVertical: 12 },
  quoteText: { color: '#fff', fontSize: 24, lineHeight: 32, letterSpacing: -0.3 },
  watermarkBox: { flexDirection: 'row', alignItems: 'center' },
  watermarkText: { fontFamily: 'Outfit_800ExtraBold', color: 'rgba(255,255,255,0.8)', fontSize: 14, letterSpacing: -0.5 },

  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.95)',
    paddingVertical: 16,
    paddingHorizontal: 44,
    borderRadius: 30,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  shareBtnText: { color: '#000', fontSize: 17, fontWeight: '800' },
});
