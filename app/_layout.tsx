// @ts-nocheck
import { useEffect } from 'react';
import { LogBox, Alert } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as ScreenCapture from 'expo-screen-capture';

import { setJSExceptionHandler } from 'react-native-exception-handler';
// Fallback
if (typeof ErrorUtils !== 'undefined') {
  ErrorUtils.setGlobalHandler((err, isFatal) => {
    console.error('GLOBAL JS ERROR:', err);
    Alert.alert('Fatal JS Error', err ? err.message : 'Unknown error');
  });
}



// Crash reporting: catches JS errors and native iOS/Android crashes.
// Native crashes are sent on the next app launch.
try {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
    debug: false,
    enableNative: true,
    enableNativeCrashHandling: true,
    attachStacktrace: true,
    tracesSampleRate: 0.2,
  });
} catch (e) {}

// Keep the native splash screen visible until we are ready — this PREVENTS the white flash
try {
  SplashScreen.preventAutoHideAsync().catch(() => {});
} catch (e) {}


import { Stack, useRouter, useSegments } from 'expo-router';
import { View, Text, ScrollView } from 'react-native';
import { ErrorBoundary } from 'react-error-boundary';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, DarkTheme } from 'expo-router';
import { StyleSheet } from 'react-native';
import AnimatedSplash from '../components/AnimatedSplash';
import ThemeEffects from '../components/ThemeEffects';
import { useFonts, Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold, Outfit_900Black } from '@expo-google-fonts/outfit';
import { registerForPushNotificationsAsync } from '../lib/notifications';
import { registerInstall } from '../lib/installTracker';
import '../i18n';

// Ignore harmless background Supabase auth network errors and Expo Go splash screen fast-refresh warnings in dev mode
LogBox.ignoreLogs(['TypeError: Network request failed', 'No native splash screen registered']);

const customTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0A0A0F',
  },
};


function RootLayout() {
  const { init, session, isLoading, isOfflineMode } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });

  useEffect(() => {
    useAuthStore.getState().init();
    usePlayerStore.getState().initPlayer();
    
    // Force allow screenshots globally in case the native flag is stuck from hot-reloading
    try {
      ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      registerForPushNotificationsAsync(session.user.id);
    }
    // Count this install for the admin dashboard (re-runs on login to link the account)
    registerInstall();
  }, [session?.user?.id]);

  useEffect(() => {
    // Hide the NATIVE splash screen only once fonts are loaded and auth has resolved.
    if (fontsLoaded && !isLoading) {
      setTimeout(async () => {
        try {
          await SplashScreen.hideAsync();
        } catch (e) {}
      }, 100);
    }
  }, [fontsLoaded, isLoading]);

  // HARD FALLBACK: Ensure the native splash screen ALWAYS hides after 3.5 seconds
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {}
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === 'auth';
    
    // Defer the routing to ensure the navigation container is fully mounted
    setTimeout(() => {
      if (!session && !inAuthGroup && !isOfflineMode) {
        // Auto sign in as Guest
        useAuthStore.getState().signInAnonymously().then((err) => {
          if (err) {
            // Fallback to offline mode to prevent infinite loop if DB fails
            useAuthStore.getState().enableOfflineMode();
          }
          router.replace('/');
        });
      } else if (session && inAuthGroup) {
        const isGuest = session.user?.is_anonymous === true || session.user?.app_metadata?.provider === 'anonymous';
        if (!isGuest) {
          // Only kick them out of auth page if they are fully logged in (not guest)
          router.replace('/');
        }
      } else if (isOfflineMode && inAuthGroup) {
        router.replace('/');
      }
    }, 0);
  }, [session, isLoading, segments, isOfflineMode]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary fallbackRender={({error}) => (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#0A0A0F', marginTop: 50}}>
          <Text style={{color: 'red', fontSize: 18, fontWeight: 'bold', marginBottom: 10}}>APP CRASHED!</Text>
          <ScrollView style={{maxHeight: 400}}>
            <Text style={{color: 'white'}}>{error.message}</Text>
            <Text style={{color: 'gray', fontSize: 10, marginTop: 10}}>{error.stack}</Text>
          </ScrollView>
        </View>
      )}>
      <ThemeProvider value={customTheme}>
        <StatusBar style="light" backgroundColor="#0A0A0F" />
        <Stack screenOptions={{ headerShown: false, headerBackTitleVisible: false, headerBackTitle: ' ', contentStyle: { backgroundColor: '#0A0A0F' }, animation: 'fade' }}>
          <Stack.Screen name="(tabs)" options={{ title: '' }} />
          <Stack.Screen name="auth" />
          <Stack.Screen name="track/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="player" options={{ presentation: 'modal' }} />
          <Stack.Screen name="buy-credits" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="settings/theme" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="settings/pair-partner" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="settings/edit-profile" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="settings/verify" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="settings/support" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="settings/become-artist" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="settings/language" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="settings/notifications" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="settings/about" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="artist/dashboard" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="artist/[id]" />
          <Stack.Screen name="playlist/[id]" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="genre/[name]" />
        </Stack>
        <AnimatedSplash isReady={fontsLoaded && !isLoading} />
        <ThemeEffects />
      </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

export default RootLayout;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0F' },
});
