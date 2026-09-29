import { Tabs, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import { GlassView as BlurView } from '@/components/GlassView';
import { BottomTabBar } from 'expo-router/build/react-navigation/bottom-tabs';
import { useThemeStore } from '../../store/themeStore';
import { useLayoutStore } from '../../store/layoutStore';
import { useEffect, useRef } from 'react';

import MiniPlayer from '../../components/MiniPlayer';
import { usePlayerStore } from '../../store/playerStore';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

function TabBarIcon({ name, color }: { name: React.ComponentProps<typeof Ionicons>['name']; color: string }) {
  return <Ionicons name={name} size={28} color={color} />;
}

export default function TabsLayout() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const { t } = useTranslation();
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const profile = useAuthStore(s => s.profile);
  const segments = useSegments();
  const hideMiniPlayer = segments.includes('ai-studio');
  
  const isNavVisible = useLayoutStore(s => s.isNavVisible);
  const tabTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(tabTranslateY, {
      toValue: isNavVisible ? 0 : 200, // Slide down completely
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isNavVisible]);

  return (
    <View style={styles.container}>
      <Tabs
        sceneContainerStyle={{ backgroundColor: COLORS.black }}
        tabBar={(props) => (
          <Animated.View style={[styles.tabBarOuter, { transform: [{ translateY: tabTranslateY }] }]}>
            {/* Glassmorphism blur for tab bar */}
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={styles.tabBarTopBorder} />
            {currentTrack && !hideMiniPlayer && <MiniPlayer />}
            {currentTrack && !hideMiniPlayer && <View style={styles.playerTabDivider} />}
            <BottomTabBar {...props} />
          </Animated.View>
        )}
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: COLORS.gold,
          tabBarInactiveTintColor: COLORS.textTertiary,
          tabBarLabelStyle: styles.label,
          tabBarShowLabel: true,
        }}
        screenListeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.home'),
            tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          }}
        />

        <Tabs.Screen
          name="ai-studio"
          options={{
            title: "",
            tabBarLabel: () => null,
            tabBarIcon: ({ focused }) => (
              <View style={[styles.studioIconOuter, focused && styles.studioIconOuterFocused]}>
                <Ionicons name="musical-notes" size={24} color={COLORS.white} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="upload"
          options={{
            title: t('tabs.upload'),
            href: ((profile?.role as any) === 'artist' || (profile?.role as any) === 'admin') ? '/upload' : null,
            tabBarIcon: ({ color }) => <Ionicons name="cloud-upload" size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="radio"
          options={{
            title: "Live",
            href: null, // Hidden from tab bar - accessible from Profile
            tabBarIcon: ({ color }) => <TabBarIcon name="radio" color={color} />,
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            tabBarIcon: ({ color }) => <TabBarIcon name="library" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs.profile'),
            tabBarIcon: ({ color }) => <TabBarIcon name="person" color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  tabBarOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 10, 15, 0.98)',
    overflow: 'hidden',
  },
  playerTabDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tabBarTopBorder: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  customTabBar: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 86 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'transparent',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  tabBar: {
    backgroundColor: 'transparent', // Let BlurView show through
    position: 'relative',
    borderTopWidth: 0,
    height: Platform.OS === 'ios' ? 90 : 72,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 10,
    elevation: 0,
  },
  studioIconOuter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  studioIconOuterFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
// force hot reload


