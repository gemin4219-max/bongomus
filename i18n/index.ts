import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './en';
import sw from './sw';

const LANGUAGE_KEY = 'bongo_language';

const resources = {
  en: { translation: en },
  sw: { translation: sw }
};

const initI18n = async () => {
  let savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
  
  if (!savedLanguage) {
    const deviceLocales = Localization.getLocales();
    savedLanguage = deviceLocales[0]?.languageCode === 'en' ? 'en' : 'sw';
  }

  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: savedLanguage,
      fallbackLng: 'sw',
      compatibilityJSON: 'v3' as any, // Required for React Native Android
      interpolation: {
        escapeValue: false
      }
    });
};

initI18n();

export default i18n;
