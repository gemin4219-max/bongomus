import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * A storage adapter for Supabase that stores a short refresh token in SecureStore
 * (to survive app uninstalls on most devices) and the full session in AsyncStorage.
 * This ensures "Guest Identity Persistence".
 */
const SECURE_TOKEN_KEY = 'bongo_secure_refresh_token';

export const SecureStorageAdapter = {
  getItem: async (key: string) => {
    // 1. Get from AsyncStorage (fast path, works during normal app usage)
    let sessionStr = await AsyncStorage.getItem(key);
    
    // 2. If missing from AsyncStorage (e.g. after uninstall/reinstall), try to recover using SecureStore
    if (!sessionStr) {
      try {
        const refreshToken = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
        if (refreshToken) {
          // If we have a refresh token, we can mock a tiny session payload.
          // Supabase's `getSession` or `onAuthStateChange` will detect the refresh token
          // and automatically exchange it for a full session via the network.
          console.log("Recovered guest session from SecureStore!");
          
          const recoveredSession = {
            access_token: '',
            refresh_token: refreshToken,
            user: { id: 'recovered', is_anonymous: true }, // We just need enough for supabase client to trigger a refresh
          };
          
          return JSON.stringify(recoveredSession);
        }
      } catch (e) {
        console.log("Error reading from SecureStore", e);
      }
    }
    
    return sessionStr;
  },
  setItem: async (key: string, value: string) => {
    // Save to AsyncStorage
    await AsyncStorage.setItem(key, value);
    
    // Also save the refresh_token to SecureStore if it exists
    try {
      const parsed = JSON.parse(value);
      if (parsed?.refresh_token) {
        await SecureStore.setItemAsync(SECURE_TOKEN_KEY, parsed.refresh_token);
      }
    } catch (e) {
      // ignore parse errors
    }
  },
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key);
    try {
      await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
    } catch (e) {}
  },
};
