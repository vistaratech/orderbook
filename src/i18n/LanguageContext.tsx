import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LanguageCode,
  LanguageOption,
  SUPPORTED_LANGUAGES,
  translations,
} from './translations';

const LANGUAGE_STORAGE_KEY = 'order_book:app_language';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  t: (path: string, fallback?: string) => string;
  currentLangOption: LanguageOption;
  availableLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: async () => { },
  t: (path: string) => path,
  currentLangOption: SUPPORTED_LANGUAGES[0],
  availableLanguages: SUPPORTED_LANGUAGES,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLangState] = useState<LanguageCode>('en');

  // Load persisted language from AsyncStorage on app startup
  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((saved) => {
        if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
          setLangState(saved as LanguageCode);
        }
      })
      .catch(() => { });
  }, []);

  const setLanguage = useCallback(async (newLang: LanguageCode) => {
    setLangState(newLang);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
    } catch { }
  }, []);

  /**
   * Helper translation function:
   * e.g. t('nav.dashboard') -> 'Dashboard' (en) | 'முகப்பு' (ta) | 'डैशबोर्ड' (hi)
   */
  const t = useCallback(
    (path: string, fallback?: string): string => {
      const langDict = translations[language] || translations.en;
      const keys = path.split('.');
      let current: any = langDict;

      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          // Fallback to English dictionary if key missing in chosen language
          let enCurrent: any = translations.en;
          for (const ek of keys) {
            if (enCurrent && typeof enCurrent === 'object' && ek in enCurrent) {
              enCurrent = enCurrent[ek];
            } else {
              enCurrent = undefined;
              break;
            }
          }
          return typeof enCurrent === 'string' ? enCurrent : fallback || path;
        }
      }

      return typeof current === 'string' ? current : fallback || path;
    },
    [language]
  );

  const currentLangOption =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        currentLangOption,
        availableLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
