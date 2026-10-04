// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { GlassView as BlurView } from '@/components/GlassView';
import { Ionicons } from '@expo/vector-icons';

interface GlassTrackCardProps {
  title: string;
  subtitle: string;
  imageUrl?: string;
  duration?: string;
  onPress: () => void;
}

export default function GlassTrackCard({ title, subtitle, imageUrl, duration, onPress }: GlassTrackCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.container}>
      {/* Full-bleed Cover Image */}
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.backgroundImage} contentFit="cover" />
      ) : (
        <View style={[styles.backgroundImage, styles.placeholder]}>
          <Ionicons name="musical-notes" size={40} color="rgba(255,255,255,0.2)" />
        </View>
      )}

      {/* Top Right Duration Badge */}
      {duration && (
        <View style={styles.durationBadge}>
          <BlurView intensity={30} tint="dark" style={styles.durationBlur}>
            <Text style={styles.durationText}>{duration}</Text>
          </BlurView>
        </View>
      )}

      {/* Push content to bottom */}
      <View style={{ flex: 1 }} />

      {/* Thick frosted glass overlay at the bottom */}
      <BlurView intensity={70} tint="dark" style={styles.bottomOverlay}>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
        <TouchableOpacity style={styles.playButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="play" size={12} color="#fff" style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 150,
    height: 190,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#1a1a24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  durationBlur: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  bottomOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(10,10,15,0.2)', // Slight dark tint to ensure text readability
  },
  textWrap: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  playButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});
