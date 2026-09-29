import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { GlassView as BlurView } from '@/components/GlassView';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface LiveRadioTunerProps {
  station?: any;
  onPress: () => void;
}

const EQBar = ({ delay }: { delay: number }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 400 + Math.random() * 400,
          delay: delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 400 + Math.random() * 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        })
      ])
    ).start();
  }, []);

  const height = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 24] // Bars go from 4px to 24px high
  });

  return (
    <Animated.View style={[styles.eqBar, { height }]} />
  );
};

export default function LiveRadioTuner({ station, onPress }: LiveRadioTunerProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true })
      ])
    ).start();
  }, []);

  if (!station) return null; // Or render a placeholder if no stations are live

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.container}>
      {/* Background glowing gradient */}
      <LinearGradient 
        colors={['rgba(212,175,55,0.2)', 'rgba(0,0,0,0.8)']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={StyleSheet.absoluteFillObject} 
      />

      <BlurView intensity={70} tint="dark" style={styles.glassPanel}>
        
        {/* Top Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.onAirBadge}>
            <Animated.View style={[styles.redDot, { opacity: pulseAnim }]} />
            <Text style={styles.onAirText}>LIVE RADIO</Text>
          </View>
          <Text style={styles.listeners}>{station.listener_count || 124} Listening</Text>
        </View>

        <View style={styles.mainContent}>
          {/* LCD Screen / Visualizer */}
          <View style={styles.lcdScreen}>
            <View style={styles.eqContainer}>
              <EQBar delay={0} />
              <EQBar delay={150} />
              <EQBar delay={50} />
              <EQBar delay={200} />
              <EQBar delay={100} />
            </View>
            <Text style={styles.frequencyText}>88.9</Text>
            <Text style={styles.fmText}>FM</Text>
          </View>

          {/* Station Details */}
          <View style={styles.stationDetails}>
            <Text style={styles.stationTitle} numberOfLines={1}>{station.title || 'Bongo Flava Mix'}</Text>
            <Text style={styles.djText} numberOfLines={1}>
              <Ionicons name="mic" size={12} color="rgba(255,255,255,0.5)" /> Hosted by {station.profiles?.display_name || 'DJ Khalid'}
            </Text>
          </View>

          {/* Dial Knob */}
          <View style={styles.knobOuter}>
            <View style={styles.knobInner}>
              <View style={styles.knobNotch} />
            </View>
          </View>
        </View>

        {/* Acrylic Edge Highlight */}
        <View style={styles.edgeHighlight} />
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    marginBottom: 40, // Ensure space at very bottom of feed
  },
  glassPanel: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  onAirBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.3)',
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B30',
    marginRight: 6,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  onAirText: {
    color: '#FF3B30',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  listeners: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '500',
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  lcdScreen: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  eqContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 24,
    marginRight: 10,
    gap: 3,
  },
  eqBar: {
    width: 4,
    backgroundColor: '#D4AF37', // Gold bars
    borderRadius: 2,
  },
  frequencyText: {
    color: '#D4AF37',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
    fontFamily: 'monospace', // Gives it a digital clock look
    textShadowColor: 'rgba(212,175,55,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  fmText: {
    color: 'rgba(212,175,55,0.6)',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 2,
    marginBottom: 4,
  },
  stationDetails: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  stationTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  djText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  knobOuter: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
  },
  knobInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  knobNotch: {
    width: 4,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    position: 'absolute',
    top: 4,
  },
  edgeHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
});
