// @ts-nocheck
import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { BlurView, BlurViewProps } from 'expo-blur';

export function GlassView(props: BlurViewProps) {
  if (Platform.OS === 'android') {
    // Fallback to a semi-transparent view on Android to prevent 
    // eightbitlab RenderScript crashes and OutOfMemoryErrors
    return (
      <View 
        style={[
          props.style, 
          { backgroundColor: props.tint === 'dark' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)' }
        ]} 
      >
        {props.children}
      </View>
    );
  }

  return (
    <BlurView {...props} />
  );
}
