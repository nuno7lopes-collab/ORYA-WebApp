import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, i18n, initI18n } from "@orya/shared";

const LOCALE_STORAGE_KEY = "orya.locale";

const normalizeLocale = (tag?: string | null): Locale | null => {
  if (!tag) return null;
  const lower = tag.toLowerCase();
  if (lower.startsWith("pt")) return "pt-PT";
  if (lower.startsWith("en")) return "en-US";
  if (lower.startsWith("es")) return "es-ES";
  return null;
};

export const resolveDeviceLocale = (): Locale => {
  const locales = Localization.getLocales();
  for (const locale of locales) {
    const normalized = normalizeLocale(locale.languageTag);
    if (normalized) return normalized;
  }
  return DEFAULT_LOCALE;
};

export const getStoredLocale = async (): Promise<Locale | null> => {
  try {
    const value = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    if (value && (SUPPORTED_LOCALES as readonly string[]).includes(value)) {
      return value as Locale;
    }
  } catch {
    // ignore
  }
  return null;
};

export const initMobileI18n = async (): Promise<void> => {
  if (i18n.isInitialized) return;
  const stored = await getStoredLocale();
  const initialLocale = stored ?? resolveDeviceLocale();
  await initI18n(initialLocale);
};

export const setLocale = async (locale: Locale): Promise<void> => {
  if (!i18n.isInitialized) {
    await initI18n(locale);
  }
  await i18n.changeLanguage(locale);
  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
};

export const useI18n = () => {
  const [ready, setReady] = useState(i18n.isInitialized);
  const [locale, setLocaleState] = useState<Locale>(
    (i18n.language as Locale) || DEFAULT_LOCALE,
  );

  useEffect(() => {
    let active = true;
    initMobileI18n()
      .then(() => {
        if (!active) return;
        setReady(true);
        setLocaleState((i18n.language as Locale) || DEFAULT_LOCALE);
      })
      .catch(() => {
        if (!active) return;
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handler = (lng: string) => {
      if ((SUPPORTED_LOCALES as readonly string[]).includes(lng)) {
        setLocaleState(lng as Locale);
      }
    };
    i18n.on("languageChanged", handler);
    return () => {
      i18n.off("languageChanged", handler);
    };
  }, []);

  return {
    ready,
    locale,
    setLocale,
  };
};

export type { Locale };
