// @ts-nocheck
import { Alert } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-reanimated';


// Catch any unhandled JS errors and show them in a native alert before crashing
const originalHandler = (global as any).ErrorUtils?.getGlobalHandler();
if ((global as any).ErrorUtils) {
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    try {
      Alert.alert(
        'Fatal JS Error Caught!',
        `Error: ${error.message}\n\nPlease take a screenshot of this error.`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      console.error('Failed to show error alert', e);
    }
    
    // We purposefully DO NOT call originalHandler here if it is fatal
    // because calling it tells React Native to crash the app immediately, 
    // which prevents the user from reading the Alert!
  });
}

require('expo-router/entry');

import TrackPlayer from 'react-native-track-player';
TrackPlayer.registerPlaybackService(() => require('./service.js'));
