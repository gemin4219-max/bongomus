import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { GlassView as BlurView } from '@/components/GlassView';
import { Ionicons } from '@expo/vector-icons';

interface CategoryCollageCardProps {
  title: string;
  subtitle: string;
  images: any[]; // Array of strings or local requires
  iconName?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export default function CategoryCollageCard({ title, subtitle, images, iconName, onPress }: CategoryCollageCardProps) {
  // We want to render up to 3 images in a fanned stack.
  const displayImages = images.slice(0, 3);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.container}>
      {/* The Collage Wrap */}
      <View style={styles.coverWrap}>
        {displayImages.length > 0 ? (
          <View style={styles.stackContainer}>
            {/* 3rd Image (Left, furthest back) */}
            {displayImages[2] && (
              <Image 
                source={typeof displayImages[2] === 'string' ? { uri: displayImages[2] } : displayImages[2]} 
                style={[styles.stackedImage, { transform: [{ translateX: -20 }, { translateY: -5 }, { rotateZ: '-12deg' }, { scale: 0.85 }], zIndex: 1 }]} 
                contentFit="cover" 
              />
            )}
            {/* 2nd Image (Right, middle) */}
            {displayImages[1] && (
              <Image 
                source={typeof displayImages[1] === 'string' ? { uri: displayImages[1] } : displayImages[1]} 
                style={[styles.stackedImage, { transform: [{ translateX: 25 }, { translateY: -12 }, { rotateZ: '15deg' }, { scale: 0.9 }], zIndex: 2 }]} 
                contentFit="cover" 
              />
            )}
            {/* 1st Image (Front, straight) */}
            <Image 
              source={typeof displayImages[0] === 'string' ? { uri: displayImages[0] } : displayImages[0]} 
              style={[styles.stackedImage, { zIndex: 3, transform: [{ scale: 1 }] }]} 
              contentFit="cover" 
            />
          </View>
        ) : (
          <View style={[styles.stackedImage, styles.placeholder]}>
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
    width: 130, // Make it wider to accommodate fanning
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    overflow: 'visible', // Allow fanned books to peek out
  },
  stackContainer: {
    width: 90, // Core width of the front book
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedImage: {
    position: 'absolute',
    width: 90,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: -3, height: 5 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 10,
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
    backgroundColor: 'rgba(0,0,0,0.3)', // Darker tint for text readability
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
