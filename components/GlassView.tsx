import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { BlurView, BlurViewProps } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export function GlassView(props: BlurViewProps) {
  // Use the new dimezisBlurView for true native background blur on both iOS and Android
  // This replaces the old Android LinearGradient fallback.
  return (
    <BlurView blurMethod="dimezisBlurView" {...props} />
  );
}
