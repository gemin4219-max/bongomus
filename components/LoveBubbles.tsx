import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/themeStore';

const { width, height } = Dimensions.get('window');

function Bubble({ delay }: { delay: number }) {
  const { COLORS } = useThemeStore();
  const translateY = useRef(new Animated.Value(height)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  
  const startX = useRef(Math.random() * width).current;
  const size = useRef(Math.random() * 20 + 20).current;
  const swayAmount = useRef(Math.random() * 40 - 20).current;

  useEffect(() => {
    let isActive = true;
    
    const startAnimation = () => {
      if (!isActive) return;
      
      translateY.setValue(height + 100);
      opacity.setValue(0);
      scale.setValue(0.5);
      translateX.setValue(0);

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.6,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.delay(3000),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(scale, {
            toValue: 1.2 + Math.random() * 0.5,
            duration: 6000,
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
             toValue: swayAmount,
             duration: 6000,
             useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -100,
            duration: 6000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
        ])
      ]).start(({ finished }) => {
        if (finished && isActive) {
          startAnimation(); // Loop
        }
      });
    };

    startAnimation();
    
    return () => {
      isActive = false;
      translateY.stopAnimation();
      opacity.stopAnimation();
      scale.stopAnimation();
      translateX.stopAnimation();
    };
  }, [delay, swayAmount]);

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          left: startX,
          transform: [
            { translateY },
            { translateX },
            { scale }
          ],
          opacity
        }
      ]}
    >
      <Ionicons name="heart" size={size} color={COLORS.gold} />
    </Animated.View>
  );
}

export default function LoveBubbles() {
  const { theme } = useThemeStore();
  
  // Only render if theme is 'love'
  if (theme !== 'love') return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {[...Array(15)].map((_, i) => (
        <Bubble key={i} delay={i * 600} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999, // Ensure it's above everything
    elevation: 9999,
  },
  bubble: {
    position: 'absolute',
    top: 0, // Starts offscreen via translateY
  }
});
