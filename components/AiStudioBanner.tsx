import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { GlassView as BlurView } from '@/components/GlassView';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface AiStudioBannerProps {
  onPress: () => void;
}

export default function AiStudioBanner({ onPress }: AiStudioBannerProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.container}>
      {/* Dark Base */}
      <View style={styles.backgroundBase} />

      {/* Glowing Ambient Orbs */}
      <View style={[styles.orb, { top: -40, left: -20, backgroundColor: '#FF0055', width: 150, height: 150 }]} />
      <View style={[styles.orb, { bottom: -50, right: -30, backgroundColor: '#00F0FF', width: 180, height: 180 }]} />
      <View style={[styles.orb, { top: 20, right: 40, backgroundColor: '#6441A5', width: 100, height: 100 }]} />

      {/* Heavy Frosted Glass Overlay */}
      <BlurView intensity={90} tint="dark" style={styles.glassPanel}>
        
        {/* NEW Tag */}
        <View style={styles.newTag}>
          <Text style={styles.newTagText}>NEW FEATURE</Text>
        </View>

        <View style={styles.contentWrap}>
          <Text style={styles.title}>BECOME A</Text>
          <Text style={styles.titleHighlight}>SUPERSTAR</Text>
          <Text style={styles.subtitle}>Generate chart-topping hits in seconds using advanced AI. No studio required.</Text>
        </View>

        {/* Pulsing CTA Button */}
        <Animated.View style={[styles.ctaBtnWrap, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient 
            colors={['#FF0055', '#9D00FF']} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }} 
            style={styles.ctaBtn}
          >
            <Ionicons name="color-wand" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.ctaText}>TRY AI STUDIO NOW</Text>
          </LinearGradient>
        </Animated.View>

        {/* Edge Highlight */}
        <View style={styles.edgeHighlight} />
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 16,
    minHeight: 260, // Increased height to ensure button isn't cut off
    borderRadius: 24, // Rounder, premium corners
    overflow: 'hidden',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 10,
    shadowColor: '#9D00FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0f',
  },
  orb: {
    position: 'absolute',
    borderRadius: 200,
    opacity: 0.7,
  },
  glassPanel: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  newTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  newTagText: {
    color: '#00F0FF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  contentWrap: {
    marginTop: 8,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  titleHighlight: {
    color: '#FF0055',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
    lineHeight: 36,
    textShadowColor: 'rgba(255,0,85,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: '80%',
  },
  ctaBtnWrap: {
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  ctaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  edgeHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
    zIndex: 2,
  },
});
