// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Text, Easing } from 'react-native';
import { useThemeStore } from '../store/themeStore';


const { width, height } = Dimensions.get('window');

interface Props {
  isReady: boolean;
}

export default function AnimatedSplash({ isReady }: Props) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(30)).current;
  
  // Custom Icon Animations
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.3)).current;
  const bar3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Entrance text
    Animated.parallel([
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(textTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse the soundwave logo continuously
    const animateBar = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true })
        ])
      ).start();
    };
    
    animateBar(bar1, 0);
    animateBar(bar2, 150);
    animateBar(bar3, 300);
  }, []);

  useEffect(() => {
    if (isReady) {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(containerOpacity, {
            toValue: 0,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.15,
            duration: 800,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsAnimationComplete(true);
        });
      }, 2000); 
    }
  }, [isReady]);

  if (isAnimationComplete) return null;

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <Animated.View style={[styles.content, { transform: [{ scale }] }]}>
        
        {/* Custom Animated Logo */}
        <View style={styles.logoContainer}>
          <Animated.View style={[styles.bar, { backgroundColor: '#00C6FF', transform: [{ scaleY: bar1 }] }]} />
          <Animated.View style={[styles.bar, { backgroundColor: '#B829EA', transform: [{ scaleY: bar2 }] }]} />
          <Animated.View style={[styles.bar, { backgroundColor: '#FF3B6A', transform: [{ scaleY: bar3 }] }]} />
        </View>

        <Animated.Text style={[styles.title, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
          Bongo Stream
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
          Tanzania's Music Platform
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    gap: 8,
    marginBottom: 24,
  },
  bar: {
    width: 16,
    height: 80,
    borderRadius: 8,
    shadowColor: '#B829EA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -1.5,
    marginBottom: 4,
  },
  subtitle: {
    color: '#00C6FF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 5,
    opacity: 0.9,
  },
});
