import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { GlassView as BlurView } from '@/components/GlassView';
import { Ionicons } from '@expo/vector-icons';

interface GlassArtistHaloProps {
  name: string;
  imageUrl?: string;
  onPress: () => void;
}

export default function GlassArtistHalo({ name, imageUrl, onPress }: GlassArtistHaloProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.container}>
      {/* Outer Glass Halo */}
      <BlurView intensity={30} tint="light" style={styles.halo}>
        {/* Subtle inner glow */}
        <View style={styles.innerRing}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.placeholder]}>
              <Ionicons name="person" size={40} color="rgba(255,255,255,0.4)" />
            </View>
          )}
        </View>
      </BlurView>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 90,
  },
  halo: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  innerRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  placeholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    marginTop: 8,
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
