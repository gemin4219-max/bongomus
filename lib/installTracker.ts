/**
 * lib/installTracker.ts
 *
 * Counts app installs for the admin dashboard.
 * On first launch a random install ID is saved on the device; every launch
 * calls the `register_install` RPC, which creates the row once and then only
 * updates `last_seen` (used for "active in last 7 days").
 * Uninstalling and reinstalling the app creates a new install ID.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { supabase } from './supabase';

const STORAGE_KEY = 'bongo_install_id';

const randomId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const getInstallId = async (): Promise<string> => {
  let id = await AsyncStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = randomId();
    await AsyncStorage.setItem(STORAGE_KEY, id);
  }
  return id;
};

/** Fire-and-forget. Never throws — analytics must not break the app. */
export const registerInstall = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web') return;
    const installId = await getInstallId();
    await supabase.rpc('register_install', {
      p_install_id: installId,
      p_platform: Platform.OS,
      p_app_version: Constants.expoConfig?.version ?? null,
      p_device_model: Device.modelName ?? null,
    });
  } catch {
    // ignore — offline or table not created yet
  }
};
