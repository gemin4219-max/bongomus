// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';

export default function PersonasTab() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="mic-outline" size={80} color={COLORS.gold} />
      </View>
      <Text style={styles.title}>Voice Personas</Text>
      <Text style={styles.subtitle}>
        We are building something incredible. Soon you will be able to extract and clone custom voice personas to sing any song in any style. 
      </Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Coming Soon...</Text>
      </View>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'transparent',
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 24 
  },
  iconContainer: { 
    backgroundColor: 'rgba(212, 175, 55, 0.05)', 
    padding: 24, 
    borderRadius: 100, 
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    shadowColor: COLORS.gold, 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 16, 
    elevation: 10
  },
  title: { 
    color: COLORS.textPrimary, 
    fontSize: 28, 
    fontWeight: '900', 
    marginBottom: 12, 
    textAlign: 'center',
    letterSpacing: -0.5
  },
  subtitle: { 
    color: COLORS.textSecondary, 
    fontSize: 15, 
    textAlign: 'center', 
    lineHeight: 24,
    paddingHorizontal: 20
  },
  badge: { 
    marginTop: 40, 
    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  badgeText: { 
    color: COLORS.gold, 
    fontSize: 14, 
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase'
  }
});
