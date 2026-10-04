// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Image, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Dimensions, Alert, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAIStore } from '../store/aiStore';
import { generateCoverImage, CoverImage } from '../lib/sunoApi';

const { width } = Dimensions.get('window');
const MAX_PROMPT = 300;
const IMAGE_COUNT = 2;
const ACCENT = ['#FF2A75', '#FF5E3A'] as const;

const STYLE_PRESETS: { key: string; icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { key: 'Vibrant', icon: 'color-palette', text: 'vibrant saturated colors' },
  { key: 'Dark', icon: 'moon', text: 'dark moody cinematic lighting' },
  { key: 'Retro', icon: 'disc', text: 'retro 70s vintage vinyl aesthetic' },
  { key: 'Neon', icon: 'flash', text: 'neon glow synthwave' },
  { key: 'Minimal', icon: 'ellipse-outline', text: 'minimalist clean design' },
  { key: 'Watercolor', icon: 'brush', text: 'soft watercolor painting' },
  { key: 'Photo', icon: 'camera', text: 'photorealistic photography' },
  { key: 'Afro', icon: 'sunny', text: 'african art patterns, warm earthy tones' },
];

interface CoverArtModalProps {
  visible: boolean;
  onClose: () => void;
  songTask: any;
}

const buildAutoPrompt = (songTask: any) => {
  const track = songTask?.tracks?.[0] || songTask;
  return [track?.genre || track?.tags, track?.title, 'album cover art']
    .filter(Boolean).join(', ').slice(0, MAX_PROMPT);
};

export const CoverArtModal: React.FC<CoverArtModalProps> = ({ visible, onClose, songTask }) => {
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState('');
  const [styles_, setStyles] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<CoverImage[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const { updateTrack } = useAIStore();
  const runIdRef = useRef(0);
  const pulse = useRef(new Animated.Value(0)).current;

  // Reset state when the modal opens / song changes
  useEffect(() => {
    if (visible) {
      runIdRef.current++;
      setPrompt(buildAutoPrompt(songTask));
      setStyles([]);
      setGeneratedImages([]);
      setIsGenerating(false);
      setIsSaving(false);
      setActiveIndex(0);
    } else {
      runIdRef.current++; // ignore late results from a closed modal
    }
  }, [visible, songTask]);

  // Soft pulse while generating
  useEffect(() => {
    if (!isGenerating) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isGenerating, pulse]);

  const toggleStyle = (key: string) => {
    Haptics.selectionAsync().catch(() => {});
    setStyles(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const runId = ++runIdRef.current;
    const styleText = STYLE_PRESETS.filter(s => styles_.includes(s.key)).map(s => s.text).join(', ');
    const finalPrompt = [prompt.trim(), styleText].filter(Boolean).join(', ');

    setIsGenerating(true);
    setGeneratedImages([]);
    setActiveIndex(0);
    try {
      await generateCoverImage(finalPrompt, IMAGE_COUNT, (img) => {
        if (runIdRef.current !== runId) return;
        setGeneratedImages(prev => [...prev, img]);
      });
    } catch (e: any) {
      if (runIdRef.current === runId) {
        Alert.alert('Cover Art Failed', e.message || 'Could not generate cover art. Please try again.');
      }
    } finally {
      if (runIdRef.current === runId) setIsGenerating(false);
    }
  };

  /** Upload the chosen local image to Supabase Storage so the cover never expires. */
  const persistImage = async (img: CoverImage, trackId: string): Promise<string> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(img.uri, { encoding: FileSystem.EncodingType.Base64 });
      const path = `ai_covers/${trackId}_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('images').upload(path, decode(base64), {
        contentType: 'image/jpeg', upsert: true,
      });
      if (error) throw error;
      return supabase.storage.from('images').getPublicUrl(path).data.publicUrl;
    } catch (e) {
      console.warn('Cover upload failed, using remote URL', e);
      return img.remoteUrl;
    }
  };

  const handleSave = async () => {
    const selected = generatedImages[activeIndex];
    if (!selected || !songTask || isSaving) { onClose(); return; }
    const trackId = songTask.tracks?.[0]?.id || songTask.id || songTask.taskId;
    if (!trackId) { onClose(); return; }

    setIsSaving(true);
    const finalUrl = await persistImage(selected, String(trackId));
    updateTrack(songTask.taskId || songTask.id, trackId, { imageUrl: finalUrl });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setIsSaving(false);
    onClose();

    const { error } = await supabase.from('tracks').update({ cover_url: finalUrl }).eq('id', trackId);
    if (error) console.error('Failed to update cover art in DB', error);
  };

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / slideSize));
  };

  const songTitle = songTask?.tracks?.[0]?.title || songTask?.title || 'Unknown';
  const canGenerate = prompt.trim().length > 0 && !isGenerating;
  const hasImages = generatedImages.length > 0;
  const showPendingSlide = isGenerating && hasImages && generatedImages.length < IMAGE_COUNT;
  const slideCount = generatedImages.length + (showPendingSlide ? 1 : 0);
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.modalContent}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerTitles}>
              <Text style={styles.title}>Cover Art</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{songTitle}</Text>
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, (!hasImages || isSaving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!hasImages || isSaving}
            >
              {isSaving
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={[styles.saveBtnText, !hasImages && styles.saveBtnTextDisabled]}>Save</Text>}
            </TouchableOpacity>
          </View>

          {/* Main Content Area */}
          <View style={styles.mainArea}>
            {hasImages ? (
              <View style={styles.resultsArea}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  contentContainerStyle={{ paddingHorizontal: 20 }}
                >
                  {generatedImages.map((img, index) => (
                    <View key={img.uri} style={[styles.imageWrapper, { width: width - 40, marginRight: index === slideCount - 1 ? 0 : 20 }]}>
                      <Image source={{ uri: img.uri }} style={styles.generatedImage} />
                      <View style={styles.optionBadge}>
                        <Text style={styles.optionBadgeText}>Option {index + 1}</Text>
                      </View>
                    </View>
                  ))}
                  {showPendingSlide && (
                    <View style={[styles.imageWrapper, styles.pendingSlide, { width: width - 40 }]}>
                      <ActivityIndicator size="large" color={ACCENT[0]} />
                      <Text style={styles.pendingText}>Creating option {generatedImages.length + 1}…</Text>
                    </View>
                  )}
                </ScrollView>
                <View style={styles.pagination}>
                  {Array.from({ length: slideCount }).map((_, i) => (
                    <View key={i} style={[styles.dot, activeIndex === i && styles.dotActive]} />
                  ))}
                </View>
              </View>
            ) : isGenerating ? (
              <View style={styles.generatingState}>
                <Animated.View style={{ transform: [{ scale: pulseScale }], opacity: pulseOpacity }}>
                  <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.generatingOrb}>
                    <Ionicons name="color-wand" size={34} color="#FFF" />
                  </LinearGradient>
                </Animated.View>
                <Text style={styles.generatingText}>Painting your cover…</Text>
                <Text style={styles.generatingSub}>This usually takes 5–20 seconds</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="image-outline" size={30} color={ACCENT[0]} />
                </View>
                <Text style={styles.emptyTitle}>Design your cover</Text>
                <Text style={styles.emptyText}>Describe it below, pick a style, then tap Generate</Text>
              </View>
            )}
          </View>

          {/* Composer */}
          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
              keyboardShouldPersistTaps="handled"
            >
              {STYLE_PRESETS.map(s => {
                const active = styles_.includes(s.key);
                return (
                  <TouchableOpacity
                    key={s.key}
                    id={`cover-style-${s.key.toLowerCase()}`}
                    activeOpacity={0.8}
                    onPress={() => toggleStyle(s.key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Ionicons name={s.icon} size={14} color={active ? '#FFF' : '#A0A0A8'} />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.key}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.card, isFocused && styles.cardFocused]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardLabelRow}>
                  <Ionicons name="sparkles" size={14} color={ACCENT[0]} />
                  <Text style={styles.cardLabel}>Describe your cover</Text>
                </View>
                <Text style={[styles.counter, prompt.length >= MAX_PROMPT && { color: ACCENT[0] }]}>
                  {prompt.length}/{MAX_PROMPT}
                </Text>
              </View>

              <TextInput
                id="cover-prompt-input"
                style={styles.textInput}
                placeholder="e.g. A glowing cross over a sunrise, golden light, hands raised in worship"
                placeholderTextColor="#5E5E66"
                value={prompt}
                onChangeText={setPrompt}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                multiline
                maxLength={MAX_PROMPT}
                textAlignVertical="top"
                selectionColor={ACCENT[0]}
              />

              <View style={styles.cardFooter}>
                <View style={styles.toolRow}>
                  <TouchableOpacity
                    id="cover-prompt-auto"
                    style={styles.toolBtn}
                    onPress={() => setPrompt(buildAutoPrompt(songTask))}
                    hitSlop={8}
                  >
                    <Ionicons name="refresh" size={16} color="#A0A0A8" />
                    <Text style={styles.toolText}>Auto</Text>
                  </TouchableOpacity>
                  {prompt.length > 0 && (
                    <TouchableOpacity id="cover-prompt-clear" style={styles.toolBtn} onPress={() => setPrompt('')} hitSlop={8}>
                      <Ionicons name="close" size={16} color="#A0A0A8" />
                      <Text style={styles.toolText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  id="cover-generate-btn"
                  activeOpacity={0.85}
                  onPress={handleGenerate}
                  disabled={!canGenerate}
                  style={!canGenerate && !isGenerating ? { opacity: 0.4 } : undefined}
                >
                  <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.generateBtn}>
                    {isGenerating ? (
                      <>
                        <ActivityIndicator size="small" color="#FFF" />
                        <Text style={styles.generateText}>Creating…</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name={hasImages ? 'refresh' : 'color-wand'} size={16} color="#FFF" />
                        <Text style={styles.generateText}>{hasImages ? 'Regenerate' : 'Generate'}</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0E10',
  },
  modalContent: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1F1F23',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    height: 40,
    minWidth: 76,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#1F1F23',
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 16,
  },
  saveBtnTextDisabled: {
    color: '#555',
  },
  mainArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(255,42,117,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,42,117,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    color: '#8A8A92',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  generatingState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatingOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF2A75',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  generatingText: {
    color: '#FFF',
    marginTop: 24,
    fontSize: 17,
    fontWeight: '600',
  },
  generatingSub: {
    color: '#7A7A82',
    marginTop: 6,
    fontSize: 13,
  },
  resultsArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  generatedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  optionBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  optionBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pendingSlide: {
    backgroundColor: '#17171A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pendingText: {
    color: '#9A9AA2',
    marginTop: 14,
    fontSize: 14,
  },
  pagination: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
    marginHorizontal: 4,
  },
  dotActive: {
    width: 20,
    backgroundColor: '#FF2A75',
  },

  // ── Composer ────────────────────────────────────────────────────────────
  composer: {
    paddingTop: 10,
  },
  chipsRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    backgroundColor: 'rgba(255,42,117,0.18)',
    borderColor: '#FF2A75',
  },
  chipText: {
    color: '#A0A0A8',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 22,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  cardFocused: {
    borderColor: 'rgba(255,42,117,0.6)',
    backgroundColor: '#1B1A1F',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardLabel: {
    color: '#C8C8CE',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  counter: {
    color: '#5E5E66',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  textInput: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 22,
    minHeight: 66,
    maxHeight: 120,
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 0,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  toolText: {
    color: '#A0A0A8',
    fontSize: 13,
    fontWeight: '500',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 20,
    borderRadius: 21,
  },
  generateText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
