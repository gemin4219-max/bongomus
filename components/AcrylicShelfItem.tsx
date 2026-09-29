import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { GlassView as BlurView } from '@/components/GlassView';
import { Ionicons } from '@expo/vector-icons';

interface AcrylicShelfItemProps {
  title: string;
  subtitle: string;
  imageSource?: any;
  iconName?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export default function AcrylicShelfItem({ title, subtitle, imageSource, iconName, onPress }: AcrylicShelfItemProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.container}>
      {/* The Item (Book/Album/Category Cover) */}
      <View style={styles.coverWrap}>
        {imageSource ? (
          <Image source={typeof imageSource === 'string' ? { uri: imageSource } : imageSource} style={styles.coverImage} contentFit="cover" />
        ) : (
          <View style={[styles.coverImage, styles.placeholder]}>
            <Ionicons name={iconName || 'musical-notes'} size={40} color="rgba(255,255,255,0.4)" />
          </View>
        )}
      </View>

      {/* The Acrylic Pocket (Glassmorphic) */}
      <View style={styles.acrylicPocket}>
        <BlurView intensity={30} tint="dark" style={styles.blurWrap}>
          {/* 4 Screws */}
          <View style={[styles.screw, { top: 6, left: 6 }]} />
          <View style={[styles.screw, { top: 6, right: 6 }]} />
          <View style={[styles.screw, { bottom: 6, left: 6 }]} />
          <View style={[styles.screw, { bottom: 6, right: 6 }]} />
          
          {/* Subtle gradient overlay to make it look like thick acrylic */}
          <View style={styles.acrylicHighlight} />

          {/* Text inside the pocket */}
          <View style={styles.pocketContent}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </BlurView>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 140,
    alignItems: 'center',
    marginBottom: 8,
  },
  coverWrap: {
    width: 110,
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    zIndex: 1,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  acrylicPocket: {
    position: 'absolute',
    bottom: 5,
    width: 130, 
    height: 55,
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  blurWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pocketContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  screw: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 1,
  },
  acrylicHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  title: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
