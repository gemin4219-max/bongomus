// @ts-nocheck
import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function AppBannerAd() {
  return (
    <View style={styles.container}>
      {/* Ads disabled for Expo Go */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
});

